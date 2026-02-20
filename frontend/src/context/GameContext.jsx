/**
 * Pepper's Universe — Game Context
 *
 * Single React Context with useReducer for all gamification state.
 * Handles: points, streaks, achievements, biome, character unlocks,
 * Pepper events, and hybrid anonymous auth.
 *
 * Pattern: optimistic updates + server reconciliation.
 *
 * Usage:
 *   const { state } = useGame();
 *   const { sendEvent, setBiome } = useGameActions();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { api } from "../api/client";
import { getBiome, getCharacter, getTimeOfDay } from "../data/biomes";

// ---------------------------------------------------------------------------
// Anonymous UUID (persisted in localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "stylescope_anon_uuid";

function getOrCreateUUID() {
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  // Identity
  uuid: null,
  userId: null, // null = anonymous
  isLinked: false,

  // Core game state
  points: 0,
  lifetimePoints: 0,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,

  // Biome & characters
  activeBiome: "peppers_home",
  favoriteBiome: null,
  unlockedBiomes: ["peppers_home", "sweet_garden"],
  unlockedCharacters: ["pepper", "honey"],

  // Progress
  achievements: [],
  discoveredLore: [],
  readerProfile: null,
  stats: {
    totalSearches: 0,
    totalBooksViewed: 0,
    totalGemsFound: 0,
    totalScoresRequested: 0,
  },

  // UI state
  timeOfDay: getTimeOfDay(),
  pendingEvents: [], // optimistic queue
  toasts: [], // { id, type, message, data }
  loading: true,
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function gameReducer(state, action) {
  switch (action.type) {
    case "INIT_SESSION":
      return {
        ...state,
        uuid: action.payload.uuid,
        points: action.payload.points,
        lifetimePoints: action.payload.lifetime_points,
        streak: action.payload.streak,
        longestStreak: action.payload.longest_streak,
        lastActiveDate: action.payload.last_active_date,
        activeBiome: action.payload.active_biome || "peppers_home",
        favoriteBiome: action.payload.favorite_biome,
        unlockedBiomes: action.payload.unlocked_biomes || ["peppers_home", "sweet_garden"],
        unlockedCharacters: action.payload.unlocked_characters || ["pepper", "honey"],
        discoveredLore: action.payload.discovered_lore || [],
        readerProfile: action.payload.reader_profile,
        achievements: action.payload.achievements || [],
        stats: {
          totalSearches: action.payload.stats?.total_searches || 0,
          totalBooksViewed: action.payload.stats?.total_books_viewed || 0,
          totalGemsFound: action.payload.stats?.total_gems_found || 0,
          totalScoresRequested: action.payload.stats?.total_scores_requested || 0,
        },
        loading: false,
        error: null,
      };

    case "INIT_FAILED":
      return { ...state, loading: false, error: action.payload };

    case "OPTIMISTIC_EVENT": {
      const pts = action.payload.estimatedPoints || 0;
      return {
        ...state,
        points: state.points + pts,
        lifetimePoints: state.lifetimePoints + pts,
        pendingEvents: [...state.pendingEvents, action.payload.eventId],
      };
    }

    case "EVENT_CONFIRMED": {
      const { result, eventId } = action.payload;
      return {
        ...state,
        points: result.new_total,
        lifetimePoints: result.lifetime_points,
        streak: result.streak,
        unlockedBiomes: result.biomes_unlocked?.length
          ? [...state.unlockedBiomes, ...result.biomes_unlocked]
          : state.unlockedBiomes,
        unlockedCharacters: result.characters_unlocked?.length
          ? [...state.unlockedCharacters, ...result.characters_unlocked]
          : state.unlockedCharacters,
        achievements: result.achievements_earned?.length
          ? [
              ...state.achievements,
              ...result.achievements_earned.map((id) => ({
                achievement_id: id,
                unlocked_at: new Date().toISOString(),
              })),
            ]
          : state.achievements,
        pendingEvents: state.pendingEvents.filter((id) => id !== eventId),
      };
    }

    case "EVENT_FAILED":
      return {
        ...state,
        points: state.points - (action.payload.rollbackPoints || 0),
        lifetimePoints: state.lifetimePoints - (action.payload.rollbackPoints || 0),
        pendingEvents: state.pendingEvents.filter(
          (id) => id !== action.payload.eventId
        ),
      };

    case "SET_BIOME":
      return { ...state, activeBiome: action.payload };

    case "LINK_ACCOUNT":
      return {
        ...state,
        userId: action.payload.userId,
        isLinked: true,
      };

    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };

    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case "UPDATE_TIME":
      return { ...state, timeOfDay: getTimeOfDay() };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Point estimation (client-side, matches backend POINT_VALUES)
// ---------------------------------------------------------------------------

const POINT_ESTIMATES = {
  app_open: 10,
  search: 5,
  book_viewed: 2,
  score_requested: 15,
  gem_found: 50,
  tbr_added: 15,
  biome_viewed: 0,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GameContext = createContext(null);
const GameActionsContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const toastCounter = useRef(0);

  // -- Initialize session on mount --
  useEffect(() => {
    const uuid = getOrCreateUUID();
    api
      .getGameSession(uuid)
      .then((data) => dispatch({ type: "INIT_SESSION", payload: { ...data, uuid } }))
      .catch((err) =>
        dispatch({ type: "INIT_FAILED", payload: err.message })
      );
  }, []);

  // -- Update time-of-day every 5 minutes --
  useEffect(() => {
    const interval = setInterval(
      () => dispatch({ type: "UPDATE_TIME" }),
      5 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  // -- Toast helper --
  const addToast = useCallback((type, message, data = {}) => {
    const id = ++toastCounter.current;
    dispatch({ type: "ADD_TOAST", payload: { id, type, message, data } });
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", payload: id }), 4000);
    return id;
  }, []);

  // -- Actions --
  const actions = useMemo(() => {
    const sendEvent = async (eventType, meta = {}) => {
      if (!state.uuid) return;

      const eventId = `${eventType}_${Date.now()}`;
      const estimatedPoints = POINT_ESTIMATES[eventType] || 0;

      // Optimistic update
      dispatch({
        type: "OPTIMISTIC_EVENT",
        payload: { eventId, estimatedPoints },
      });

      try {
        const result = await api.sendGameEvent(state.uuid, eventType, meta);

        dispatch({ type: "EVENT_CONFIRMED", payload: { result, eventId } });

        // Show toasts for notable outcomes
        if (result.streak_bonus > 0) {
          addToast("streak", `${result.streak}-day streak! +${result.streak_bonus} bonus`, {
            streak: result.streak,
          });
        }
        if (result.achievements_earned?.length) {
          result.achievements_earned.forEach((achId) => {
            addToast("achievement", `Achievement unlocked!`, { achievementId: achId });
          });
        }
        if (result.biomes_unlocked?.length) {
          result.biomes_unlocked.forEach((biomeId) => {
            const biome = getBiome(biomeId);
            addToast("biome", `New biome: ${biome.name}!`, { biomeId });
          });
        }
        if (result.characters_unlocked?.length) {
          result.characters_unlocked.forEach((charId) => {
            const char = getCharacter(charId);
            addToast("character", `${char.name} joined your crew!`, { characterId: charId });
          });
        }

        return result;
      } catch (err) {
        dispatch({
          type: "EVENT_FAILED",
          payload: { eventId, rollbackPoints: estimatedPoints },
        });
        console.error("[GameContext] Event failed:", eventType, err);
        return null;
      }
    };

    const setBiome = async (biomeId) => {
      if (!state.uuid) return;
      if (!state.unlockedBiomes.includes(biomeId)) return;

      dispatch({ type: "SET_BIOME", payload: biomeId });
      try {
        await api.setActiveBiome(state.uuid, biomeId);
      } catch (err) {
        // Revert on failure
        dispatch({ type: "SET_BIOME", payload: state.activeBiome });
        console.error("[GameContext] Set biome failed:", err);
      }
    };

    const linkAccount = async (userId) => {
      if (!state.uuid || !userId) return;
      try {
        await api.linkGameAccount(state.uuid, userId);
        dispatch({ type: "LINK_ACCOUNT", payload: { userId } });
        addToast("system", "Account linked! Your progress is saved.");
      } catch (err) {
        console.error("[GameContext] Link account failed:", err);
      }
    };

    const dismissToast = (toastId) => {
      dispatch({ type: "DISMISS_TOAST", payload: toastId });
    };

    return { sendEvent, setBiome, linkAccount, dismissToast, addToast };
  }, [state.uuid, state.unlockedBiomes, state.activeBiome, addToast]);

  return (
    <GameContext.Provider value={{ state }}>
      <GameActionsContext.Provider value={actions}>
        {children}
      </GameActionsContext.Provider>
    </GameContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within <GameProvider>");
  return ctx;
}

export function useGameActions() {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within <GameProvider>");
  return ctx;
}

// Convenience: derived data hooks
export function useActiveBiome() {
  const { state } = useGame();
  return getBiome(state.activeBiome);
}

export function useBiomePalette() {
  const { state } = useGame();
  const biome = getBiome(state.activeBiome);
  const tod = state.timeOfDay;
  if (biome.timeOfDay?.[tod]) {
    return { ...biome.palette, ...biome.timeOfDay[tod] };
  }
  return biome.palette;
}
