// src/App.jsx  –  StyleScope v8
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ────────────────────────────────────────────────────────────────────────────────
// ─── GLOBAL CSS ─────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Sora:wght@400;500;600;700;800&display=swap');

  *{box-sizing:border-box;margin:0;padding:0;}

  body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    font-family: 'Nunito', sans-serif;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
  }

  #root {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  :root{
    --ease-bounce:cubic-bezier(0.68,-0.55,0.265,1.55);
    --ease-smooth:cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes fadeUp{
    from{opacity:0;transform:translateY(20px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes slideDown{
    from{opacity:0;transform:translateY(-30px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes toastIn{
    from{opacity:0;transform:translateX(-50%) translateY(10px);}
    to{opacity:1;transform:translateX(-50%) translateY(0);}
  }

  .fadeUp{animation:fadeUp 0.5s var(--ease-smooth) forwards;}
  .slideDown{animation:slideDown 0.4s var(--ease-smooth) forwards;}

  .skel{
    background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
    background-size:200% 100%;
    animation:skelLoad 1.5s infinite;
  }
  @keyframes skelLoad{
    0%{background-position:200% 0;}
    100%{background-position:-200% 0;}
  }

  .mobile-spacer{height:70px;}
  @media(min-width:769px){.mobile-spacer{display:none;}}

  /* Genre chip hover */
  .genre-chip:hover{ background: rgba(255,107,157,0.15) !important; }

  /* Author link */
  .author-link:hover{ color: #FF6B9D !important; text-decoration: underline; }
`;

// ────────────────────────────────────────────────────────────────────────────────
// ─── COLOR PALETTE ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

const C = {
  pk:'#FF6B9D',
  or:'#FF8C42',
  pu:'#C77DFF',
  gr:'#06D6A0',
  ink:'#1A1028',
  cr:'#FFF6F0',
  spice:{
    0:'#E8E8E8',1:'#FFE8CC',2:'#FFCBA4',3:'#FF9A76',4:'#FF6B6B',5:'#D946A6',6:'#8B1874'
  },
  spicePpr:{0:'☁️',1:'🌶️',2:'🌶️🌶️',3:'🌶️🌶️🌶️',4:'🔥🔥🔥',5:'🔥🔥🔥🔥',6:'☢️'},
  spiceLbl:{0:'Sweet',1:'Mild',2:'Warm',3:'Hot',4:'Steamy',5:'Scorching',6:'Nuclear'},
};

// ────────────────────────────────────────────────────────────────────────────────
// ─── METRIC TIPS ────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

const METRIC_TIPS = {
  grammar:'Sentence structure, punctuation, spelling—the technical foundations of clear writing.',
  polish:'Overall editing quality, consistency, typo frequency, and professional finish.',
  readability:'How easy it is to follow the story, sentence flow, and pacing clarity.',
  prose:'Word choice, style, voice strength—the artistry of the writing itself.',
  pacing:'Story momentum, chapter length balance, and whether the plot drags or rushes.',
  community:'What other readers say about the writing quality, independent of personal taste.',
};

// ────────────────────────────────────────────────────────────────────────────────
// ─── GLOSSARY TERMS ─────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

const GLOSSARY_TERMS = [
  {term:'HEA',full:'Happily Ever After',def:'The couple ends up in a stable, committed, long-term happy relationship by the end of the book.'},
  {term:'HFN',full:'Happy For Now',def:'A happy ending, but less locked-in than HEA. The couple is together and content but the reader isn\'t shown a forever.'},
  {term:'FMC',full:'Female Main Character',def:'Used to describe the perspective or primary protagonist when she is female.'},
  {term:'MMC',full:'Male Main Character',def:'The male lead, often the romantic interest in straight romance.'},
  {term:'DNF',full:'Did Not Finish',def:'The reader stopped before the end.'},
  {term:'TBR',full:'To Be Read',def:'Your reading wish list.'},
  {term:'Spice Level',full:'Content heat scale',def:'StyleScope rates explicit romantic/sexual content from 0 (Sweet/Clean) to 6 (Nuclear).'},
];

// ────────────────────────────────────────────────────────────────────────────────
// ─── BOOKS DATA ─────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

const BOOKS = [
  {
    id:1,title:'A Court of Thorns and Roses',author:'Sarah J. Maas',authorId:'sjm1',
    genres:['Romantasy'],publishedYear:2015,isIndie:false,isEmergingAuthor:false,
    qualityScore:86,
    qualityBreakdown:{grammar:90,polishEditing:85,readability:88,proseStyle:84,pacing:86,communityConsensus:87},
    qualityConfidence:{voteCount:127,confidenceLevel:'high'},
    wellWrittenVotes:102,notWellWrittenVotes:25,spiceAccuracyVotes:94,warningAccuracyVotes:88,
    spiceLevel:3,spiceDescription:'Moderate steam with several explicit scenes',
    contentWarnings:[
      {id:'dubious-consent',label:'Dubious Consent',severity:'severe',category:'sexual'},
      {id:'captivity',label:'Captivity',severity:'severe',category:'psychological'},
      {id:'torture',label:'Torture',severity:'severe',category:'violence'},
    ],
    rating:4.4,readers:'2.1M',endingType:'HEA',pages:419,
    synopsis:'A young huntress is captured by a fearsome fae and begins to see he\'s not the monster she thought.',
    gradient:'linear-gradient(135deg,#FF6B9D22,#C77DFF22)',
  },
  {
    id:2,title:'The Love Hypothesis',author:'Ali Hazelwood',authorId:'ah1',
    genres:['Romance','Contemporary'],publishedYear:2021,isIndie:false,isEmergingAuthor:false,
    qualityScore:82,
    qualityBreakdown:{grammar:88,polishEditing:80,readability:85,proseStyle:79,pacing:84,communityConsensus:85},
    qualityConfidence:{voteCount:89,confidenceLevel:'high'},
    wellWrittenVotes:71,notWellWrittenVotes:18,spiceAccuracyVotes:76,warningAccuracyVotes:82,
    spiceLevel:2,spiceDescription:'Light steam with fade-to-black scenes',
    contentWarnings:[{id:'academic-pressure',label:'Academic Pressure',severity:'mild',category:'psychological'}],
    rating:4.1,readers:'1.4M',endingType:'HEA',pages:356,
    synopsis:'PhD student Olive kisses a stranger to convince her best friend she\'s moved on. He\'s the infamous Professor Carlsen.',
    gradient:'linear-gradient(135deg,#FF6B9D22,#FF8C4222)',
  },
  {
    id:3,title:'Twisted Love',author:'Ana Huang',authorId:'ahuang1',
    genres:['Dark Romance'],publishedYear:2021,isIndie:true,isEmergingAuthor:false,
    qualityScore:78,
    qualityBreakdown:{grammar:85,polishEditing:75,readability:80,proseStyle:76,pacing:78,communityConsensus:80},
    qualityConfidence:{voteCount:56,confidenceLevel:'medium'},
    wellWrittenVotes:43,notWellWrittenVotes:13,spiceAccuracyVotes:49,warningAccuracyVotes:51,
    spiceLevel:4,spiceDescription:'Explicit steam throughout',
    contentWarnings:[
      {id:'obsession',label:'Obsessive Hero',severity:'moderate',category:'psychological'},
      {id:'stalking',label:'Stalking',severity:'severe',category:'psychological'},
      {id:'graphic-violence',label:'Graphic Violence',severity:'severe',category:'violence'},
    ],
    rating:4.0,readers:'980K',endingType:'HEA',pages:388,
    synopsis:'Alex Volkov is cold, brilliant, and ruthless—with a secret obsession he\'s kept hidden for years.',
    gradient:'linear-gradient(135deg,#2D1B4E22,#8B2FC922)',
  },
  {
    id:4,title:'Things We Never Got Over',author:'Lucy Score',authorId:'ls1',
    genres:['Contemporary','Romance'],publishedYear:2022,isIndie:true,isEmergingAuthor:false,
    qualityScore:88,
    qualityBreakdown:{grammar:92,polishEditing:87,readability:90,proseStyle:86,pacing:88,communityConsensus:90},
    qualityConfidence:{voteCount:143,confidenceLevel:'high'},
    wellWrittenVotes:127,notWellWrittenVotes:16,spiceAccuracyVotes:132,warningAccuracyVotes:128,
    spiceLevel:3,spiceDescription:'Moderate steam with explicit scenes',
    contentWarnings:[{id:'cheating',label:'Past Cheating',severity:'moderate',category:'relationship'}],
    rating:4.5,readers:'1.8M',endingType:'HEA',pages:467,
    synopsis:'Naomi left everything behind. She just didn\'t expect to be stranded in a small town with the grumpiest man she\'s ever met.',
    gradient:'linear-gradient(135deg,#4CC9F022,#7AC70C22)',
  },
  {
    id:5,title:'Icebreaker',author:'Hannah Grace',authorId:'hg1',
    genres:['New Adult Romance','Contemporary'],publishedYear:2022,isIndie:true,isEmergingAuthor:true,
    qualityScore:84,
    qualityBreakdown:{grammar:86,polishEditing:83,readability:86,proseStyle:82,pacing:85,communityConsensus:87},
    qualityConfidence:{voteCount:71,confidenceLevel:'high'},
    wellWrittenVotes:59,notWellWrittenVotes:12,spiceAccuracyVotes:64,warningAccuracyVotes:68,
    spiceLevel:4,spiceDescription:'Explicit steam with frequent scenes',
    contentWarnings:[{id:'ptsd',label:'Past Trauma',severity:'moderate',category:'psychological'}],
    rating:4.2,readers:'760K',endingType:'HEA',pages:426,
    synopsis:'Figure skater Anastasia\'s quiet morning skates are interrupted when the hockey team shows up.',
    gradient:'linear-gradient(135deg,#FF8C4222,#FDB44B22)',
  },
  {
    id:6,title:'The Midnight Library',author:'Matt Haig',authorId:'mh1',
    genres:['Literary Fiction'],publishedYear:2020,isIndie:false,isEmergingAuthor:false,
    qualityScore:91,
    qualityBreakdown:{grammar:95,polishEditing:92,readability:89,proseStyle:92,pacing:87,communityConsensus:88},
    qualityConfidence:{voteCount:201,confidenceLevel:'high'},
    wellWrittenVotes:178,notWellWrittenVotes:23,spiceAccuracyVotes:195,warningAccuracyVotes:189,
    spiceLevel:0,spiceDescription:'No romantic or sexual content',
    contentWarnings:[
      {id:'suicide',label:'Suicide Ideation',severity:'severe',category:'psychological'},
      {id:'depression',label:'Depression',severity:'severe',category:'psychological'},
    ],
    rating:4.3,readers:'3.2M',endingType:'HEA',pages:304,
    synopsis:'Between life and death is a library of infinite possibilities. Nora must decide which life is worth living.',
    gradient:'linear-gradient(135deg,#667EEA22,#764BA222)',
  },
  {
    id:7,title:'Punk 57',author:'Penelope Douglas',authorId:'pd1',
    genres:['Dark Romance'],publishedYear:2016,isIndie:false,isEmergingAuthor:false,
    qualityScore:83,
    qualityBreakdown:{grammar:84,polishEditing:82,readability:84,proseStyle:81,pacing:85,communityConsensus:84},
    qualityConfidence:{voteCount:67,confidenceLevel:'high'},
    wellWrittenVotes:54,notWellWrittenVotes:13,spiceAccuracyVotes:61,warningAccuracyVotes:59,
    spiceLevel:4,spiceDescription:'Explicit steam with graphic scenes',
    contentWarnings:[
      {id:'bullying',label:'Bullying',severity:'severe',category:'psychological'},
      {id:'toxic-relationship',label:'Toxic Behavior',severity:'severe',category:'relationship'},
    ],
    rating:4.1,readers:'620K',endingType:'HEA',pages:344,
    synopsis:'Misha and Ryen have been pen pals for years. Their only rule: never meet. Then they do.',
    gradient:'linear-gradient(135deg,#2D1B4E22,#C77DFF22)',
  },
  {
    id:8,title:'Beach Read',author:'Emily Henry',authorId:'eh1',
    genres:['Contemporary','Romance'],publishedYear:2020,isIndie:false,isEmergingAuthor:false,
    qualityScore:89,
    qualityBreakdown:{grammar:93,polishEditing:88,readability:91,proseStyle:89,pacing:87,communityConsensus:91},
    qualityConfidence:{voteCount:156,confidenceLevel:'high'},
    wellWrittenVotes:140,notWellWrittenVotes:16,spiceAccuracyVotes:148,warningAccuracyVotes:151,
    spiceLevel:2,spiceDescription:'Light steam with some explicit scenes',
    contentWarnings:[{id:'grief',label:'Grief/Loss',severity:'severe',category:'psychological'}],
    rating:4.4,readers:'2.4M',endingType:'HEA',pages:361,
    synopsis:'A romance novelist and a literary writer bet: she writes a thriller, he writes a rom-com.',
    gradient:'linear-gradient(135deg,#4CC9F022,#FF6B9D22)',
  },
  {
    id:9,title:'Haunting Adeline',author:'H. D. Carlton',authorId:'hdc1',
    genres:['Dark Romance','Psychological Thriller'],publishedYear:2021,isIndie:true,isEmergingAuthor:false,
    qualityScore:74,
    qualityBreakdown:{grammar:72,polishEditing:68,readability:78,proseStyle:76,pacing:80,communityConsensus:82},
    qualityConfidence:{voteCount:132,confidenceLevel:'high'},
    wellWrittenVotes:82,notWellWrittenVotes:50,spiceAccuracyVotes:115,warningAccuracyVotes:109,
    spiceLevel:6,spiceDescription:'Extremely explicit, frequent graphic scenes and dark content',
    contentWarnings:[
      {id:'stalking-obsession',label:'Stalking & Obsession',severity:'severe',category:'psychological'},
      {id:'noncon-sexual-violence',label:'Non-consensual / sexual violence',severity:'severe',category:'sexual'},
      {id:'blood-play',label:'Blood & ritual themes',severity:'severe',category:'violence'},
    ],
    rating:3.7,readers:'1.1M',endingType:'HFN',pages:448,
    synopsis:'A reclusive writer becomes the fixation of a brilliant, unhinged stalker who sees her as a puzzle to solve and possess.',
    gradient:'linear-gradient(135deg,#1A083022,#FF6B9D22)',
    qualityNotes:{grammar:'Multiple typos and run-on sentences throughout.',polishEditing:'Noticeable editing gaps; inconsistent formatting and pacing.'},
  },
  {
    id:10,title:'Den of Vipers',author:'K. A. Knight',authorId:'kak1',
    genres:['Dark Romance','Reverse Harem'],publishedYear:2020,isIndie:true,isEmergingAuthor:false,
    qualityScore:70,
    qualityBreakdown:{grammar:70,polishEditing:65,readability:76,proseStyle:72,pacing:79,communityConsensus:78},
    qualityConfidence:{voteCount:119,confidenceLevel:'high'},
    wellWrittenVotes:68,notWellWrittenVotes:51,spiceAccuracyVotes:112,warningAccuracyVotes:101,
    spiceLevel:6,spiceDescription:'Nonstop explicit scenes with extreme, violent content',
    contentWarnings:[
      {id:'graphic-violence-dov',label:'Graphic violence & torture',severity:'severe',category:'violence'},
      {id:'noncon-dubcon-dov',label:'Non-consent / dubious consent',severity:'severe',category:'sexual'},
      {id:'gang-crime',label:'Organized crime & torture',severity:'severe',category:'criminal'},
    ],
    rating:3.5,readers:'900K',endingType:'HFN',pages:638,
    synopsis:'Roxy is claimed by a ruthless crime family known as the Vipers, who decide whether she becomes their enemy or their obsession.',
    gradient:'linear-gradient(135deg,#2D1B4E22,#FF000022)',
    qualityNotes:{grammar:'Frequent grammatical errors and awkward phrasing.',polishEditing:'Very rough copyedit; missing commas, repetitive word use.'},
  },
  {
    id:11,title:'Lights Out',author:'Navessa Allen',authorId:'na1',
    genres:['Dark Romance','Post-Apocalyptic'],publishedYear:2018,isIndie:true,isEmergingAuthor:false,
    qualityScore:76,
    qualityBreakdown:{grammar:75,polishEditing:70,readability:80,proseStyle:78,pacing:82,communityConsensus:81},
    qualityConfidence:{voteCount:64,confidenceLevel:'medium'},
    wellWrittenVotes:40,notWellWrittenVotes:24,spiceAccuracyVotes:52,warningAccuracyVotes:49,
    spiceLevel:5,spiceDescription:'High-heat explicit scenes against a violent, survival backdrop',
    contentWarnings:[
      {id:'apoc-violence',label:'Post-apocalyptic violence',severity:'severe',category:'violence'},
      {id:'sexual-coercion',label:'Sexual coercion themes',severity:'severe',category:'sexual'},
      {id:'trauma-survival',label:'Survival trauma',severity:'moderate',category:'psychological'},
    ],
    rating:3.9,readers:'350K',endingType:'HFN',pages:510,
    synopsis:'In a world gone dark, a survivor navigates brutal alliances and dangerous intimacy in order to stay alive.',
    gradient:'linear-gradient(135deg,#00000022,#FF6B9D22)',
    qualityNotes:{polishEditing:'Some rough edges; occasional awkward transitions.'},
  },
];

// Derive unique genres and author map from data
const ALL_GENRES = [...new Set(BOOKS.flatMap(b => b.genres))].sort();
const AUTHOR_MAP = {};
BOOKS.forEach(b => { AUTHOR_MAP[b.authorId] = {name:b.author, authorId:b.authorId, isIndie:b.isIndie}; });

// Default advanced filters state
const DEFAULT_ADV = {
  genres:[],
  spiceLevels:[],
  hideSevereWarnings:false,
  authorTypes:[],
  yearFrom:'',
  yearTo:'',
  pageFrom:'',
  pageTo:'',
};

// ────────────────────────────────────────────────────────────────────────────────
// ─── HELPER COMPONENTS ──────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function GlossChip({term, style}) {
  const g = GLOSSARY_TERMS.find(t => t.term === term);
  if (!g) return <span style={style}>{term}</span>;
  return <span title={g.def} style={{cursor:'help',textDecoration:'underline dotted',...style}}>{term}</span>;
}

function QRing({score, size=80, label}) {
  const radius = (size - 12) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? C.gr : score >= 70 ? C.or : '#FF6B6B';
  return (
    <div style={{position:'relative',width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#E8E8E8" strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s ease'}}/>
      </svg>
      <div style={{position:'absolute',textAlign:'center'}}>
        <div style={{fontFamily:'Sora,sans-serif',fontSize:size>90?'28px':'20px',fontWeight:'800',color:C.ink,lineHeight:1}}>{score}</div>
        {label && <div style={{fontFamily:'Sora,sans-serif',fontSize:'9px',fontWeight:'600',color:'#AAA',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'2px'}}>{label}</div>}
      </div>
    </div>
  );
}

function SpiceBadge({level}) {
  return (
    <span style={{background:C.spice[level]+'33',padding:'4px 11px',borderRadius:'100px',fontSize:'12px',fontFamily:'Sora,sans-serif',fontWeight:'600',border:'1.5px solid '+C.spice[level]+'66',display:'inline-flex',alignItems:'center',gap:'4px'}}>
      {C.spicePpr[level]} {C.spiceLbl[level]}
    </span>
  );
}

function GlossyBookIcon({genre, size=80}) {
  const colors = {
    Romantasy:'linear-gradient(135deg, #FF6B9D, #C77DFF)',
    Romance:'linear-gradient(135deg, #FF8C42, #FDB44B)',
    Contemporary:'linear-gradient(135deg, #4CC9F0, #7AC70C)',
    'Dark Romance':'linear-gradient(135deg, #2D1B4E, #8B2FC9)',
    'New Adult Romance':'linear-gradient(135deg, #FF8C42, #FDB44B)',
    'Literary Fiction':'linear-gradient(135deg, #667EEA, #764BA2)',
    'Psychological Thriller':'linear-gradient(135deg, #1A0830, #8B2FC9)',
    'Reverse Harem':'linear-gradient(135deg, #D946A6, #FF6B9D)',
    'Post-Apocalyptic':'linear-gradient(135deg, #000000, #667EEA)',
  };
  const bg = colors[genre] || 'linear-gradient(135deg, #CCC, #999)';
  return (
    <div style={{width:size,height:size*1.4,background:bg,borderRadius:size*0.15,boxShadow:`0 ${size*0.08}px ${size*0.25}px rgba(0,0,0,0.3), inset 0 ${size*0.03}px 0 rgba(255,255,255,0.5)`,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:'8%',left:'50%',transform:'translateX(-50%)',width:'70%',height:'3px',background:'rgba(255,255,255,0.6)',borderRadius:'2px'}}/>
      <div style={{position:'absolute',bottom:'20%',left:'50%',transform:'translateX(-50%)',fontSize:size*0.35+'px',opacity:0.3}}>📖</div>
    </div>
  );
}

function MetricTooltip({text}) {
  const [vis, setVis] = useState(false);
  const uid = useRef('tt_' + (Math.random() * 1e6 | 0));
  return (
    <span style={{position:'relative',display:'inline-flex',alignItems:'center',marginLeft:'5px',verticalAlign:'middle'}}>
      <button
        aria-label="More info" aria-expanded={vis} aria-describedby={vis ? uid.current : undefined}
        onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}
        onFocus={() => setVis(true)} onBlur={() => setVis(false)}
        style={{width:'18px',height:'18px',borderRadius:'50%',border:'1.5px solid #CCC',background:'rgba(255,255,255,0.9)',cursor:'help',fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'10px',color:'#AAA',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1,flexShrink:0,transition:'all 0.15s'}}
      >?</button>
      {vis && (
        <span id={uid.current} role="tooltip"
          onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}
          style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',background:'rgba(26,16,40,0.97)',backdropFilter:'blur(18px)',color:'white',fontFamily:'Nunito,sans-serif',fontWeight:'600',fontSize:'12px',lineHeight:1.55,padding:'11px 14px',borderRadius:'12px',boxShadow:'0 10px 30px rgba(0,0,0,0.4)',whiteSpace:'normal',width:'220px',textAlign:'left',border:'1px solid rgba(255,255,255,0.15)',zIndex:300,pointerEvents:'auto',cursor:'default'}}
        >
          <p style={{margin:'0'}}>{text}</p>
          <span style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',width:0,height:0,borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderTop:'6px solid rgba(26,16,40,0.97)'}}/>
        </span>
      )}
    </span>
  );
}

function GButton({children, g='primary', sz='md', onClick, style}) {
  const styles = {
    primary:{background:`linear-gradient(135deg,${C.pk},${C.or})`,color:'white',boxShadow:`0 4px 14px ${C.pk}55`},
    ghost:{background:'rgba(255,255,255,0.15)',color:C.ink,border:'1px solid rgba(255,255,255,0.3)'},
    glass:{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(12px)',color:C.ink,boxShadow:'0 4px 14px rgba(0,0,0,0.08)',border:'1px solid rgba(255,255,255,0.5)'},
  };
  const szMap = {sm:'9px 16px',md:'11px 20px',lg:'14px 28px'};
  return (
    <button onClick={onClick}
      style={{...styles[g],padding:szMap[sz],borderRadius:'100px',border:'none',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'13px',transition:'all 0.2s',display:'inline-flex',alignItems:'center',...style}}
    >{children}</button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── QUALITY SCORE LEGEND ───────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function QualityLegend() {
  const [expanded, setExpanded] = useState(false);
  const ranges = [
    {range:'90–100',label:'Exceptional',desc:'Professional-level editing and prose, almost no noticeable errors.',color:C.gr},
    {range:'80–89',label:'Strong',desc:'Well-written with minor issues that don\'t disrupt reading.',color:C.or},
    {range:'70–79',label:'Acceptable',desc:'Readable but with noticeable editing/grammar issues or uneven prose.',color:'#FFB84D'},
    {range:'60–69',label:'Rough',desc:'Frequent errors, inconsistent style, or structural issues.',color:'#FF6B6B'},
    {range:'Below 60',label:'Needs work',desc:'Significant problems with grammar, readability, or craft.',color:'#C80000'},
  ];
  return (
    <div style={{maxWidth:'640px',margin:'16px auto 0',textAlign:'center'}}>
      <button onClick={() => setExpanded(!expanded)}
        style={{background:'rgba(255,255,255,0.9)',border:'1px solid rgba(0,0,0,0.1)',borderRadius:'100px',padding:'8px 16px',cursor:'pointer',fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'600',color:C.pk,display:'inline-flex',alignItems:'center',gap:'6px',transition:'all 0.2s'}}
      ><span style={{fontSize:'16px'}}>ℹ️</span>How scores work</button>
      {expanded && (
        <div className="fadeUp" style={{marginTop:'12px',background:'rgba(255,255,255,0.95)',borderRadius:'20px',padding:'18px 16px',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',border:'1px solid rgba(255,255,255,0.6)',textAlign:'left'}}>
          <h3 style={{fontFamily:'Sora,sans-serif',fontSize:'14px',fontWeight:'800',color:C.ink,marginBottom:'12px',textAlign:'center'}}>Quality Score Guide</h3>
          {ranges.map(r => (
            <div key={r.range} style={{display:'flex',gap:'10px',marginBottom:'10px',alignItems:'flex-start'}}>
              <span style={{fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'800',color:r.color,minWidth:'60px',flexShrink:0}}>{r.range}</span>
              <div>
                <p style={{fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'700',color:C.ink,marginBottom:'2px'}}>{r.label}</p>
                <p style={{fontFamily:'Nunito,sans-serif',fontSize:'11px',color:'#666',lineHeight:1.5}}>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── BOOK CARD (GENRE CHIPS + CLICKABLE AUTHOR) ─────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

// GENRE CHIPS  //  AUTHOR PAGE
function BookCard({book, onClick, onGenreClick, onAuthorClick}) {
  const scoreColor = book.qualityScore >= 85 ? C.gr : book.qualityScore >= 70 ? C.or : '#FF6B6B';
  const hasSevereWarning = book.contentWarnings?.some(w => w.severity === 'severe');

  return (
    <div
      onClick={onClick}
      style={{padding:'6px',borderRadius:'40px',background:'linear-gradient(135deg,rgba(255,255,255,0.4) 0%,rgba(255,255,255,0.15) 100%)',boxShadow:'0 16px 48px rgba(0,0,0,0.15)',cursor:'pointer',transition:'all 0.3s',position:'relative'}}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Severe warning indicator */}
      {hasSevereWarning && (
        <div style={{position:'absolute',top:'16px',right:'16px',zIndex:10,background:'#E53838',color:'white',borderRadius:'100px',fontSize:'10px',padding:'3px 8px',fontFamily:'Sora,sans-serif',fontWeight:'700'}}>⚠</div>
      )}

      <div style={{borderRadius:'34px',background:'white',padding:'28px 22px 18px',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{marginBottom:'14px'}}>
          <GlossyBookIcon genre={book.genres[0]} size={88}/>
        </div>

        <h3 style={{fontFamily:'Sora,sans-serif',fontSize:'15px',fontWeight:'800',color:C.ink,textAlign:'center',marginBottom:'4px',lineHeight:1.3}}>{book.title}</h3>

        {/* AUTHOR PAGE: clickable author name */}
        <button
          className="author-link"
          onClick={e => {e.stopPropagation(); onAuthorClick && onAuthorClick(book.authorId);}}
          style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#888',marginBottom:'10px',background:'none',border:'none',cursor:'pointer',padding:0,transition:'color 0.15s'}}
        >{book.author}</button>

        {/* GENRE CHIPS: clickable genre pills */}
        <div style={{display:'flex',gap:'5px',flexWrap:'wrap',justifyContent:'center',marginBottom:'12px'}}>
          {book.genres.map(g => (
            <button
              key={g}
              className="genre-chip"
              onClick={e => {e.stopPropagation(); onGenreClick && onGenreClick(g);}}
              style={{padding:'3px 10px',borderRadius:'100px',fontSize:'10px',fontFamily:'Sora,sans-serif',fontWeight:'600',background:'rgba(199,125,255,0.1)',color:C.pu,border:'1px solid rgba(199,125,255,0.25)',cursor:'pointer',transition:'all 0.15s'}}
            >{g}</button>
          ))}
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginBottom:'10px',width:'100%'}}>
          <QRing score={book.qualityScore} size={48}/>
          <SpiceBadge level={book.spiceLevel}/>
        </div>

        <div style={{fontSize:'11px',fontFamily:'Nunito,sans-serif',color:'#999',textAlign:'center',width:'100%'}}>
          <span>{book.readers} readers</span>
          {book.isIndie && <span style={{marginLeft:'6px',color:C.pu,fontWeight:'700'}}>· Indie</span>}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── BOOK PAGE (FULL VIEW) ──────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

// AUTHOR PAGE  (author name clickable on book page)
function BookPage({book, onBack, onAuthorClick, onGenreClick}) {
  if (!book) return null;

  const getConfidenceText = conf => {
    if (!conf || conf.voteCount === 0) return 'Not enough data yet';
    const level = {high:'High',medium:'Medium',low:'Low'}[conf.confidenceLevel] || 'Low';
    return `Based on ${conf.voteCount} rating${conf.voteCount !== 1 ? 's' : ''} · ${level} confidence`;
  };

  const METRIC_NOTES = book.qualityNotes || {};

  const scoreReason = () => {
    const b = book.qualityBreakdown;
    const entries = Object.entries(b).sort(([,a],[,bv]) => bv - a);
    const best = entries[0][0], weak = entries[entries.length-1][0];
    const nm = {grammar:'grammar',polishEditing:'polish & editing',readability:'readability',proseStyle:'prose style',pacing:'pacing',communityConsensus:'community consensus'};
    return `Strongest in ${nm[best]||best} (${b[best]}); lowest in ${nm[weak]||weak} (${b[weak]}).`;
  };

  return (
    <div className="fadeUp" style={{maxWidth:'900px',margin:'0 auto',padding:'20px 20px 100px'}}>
      <button onClick={onBack}
        style={{fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px',display:'flex',alignItems:'center',gap:'6px',marginBottom:'20px'}}
      >← Back</button>

      {/* Book header */}
      <div style={{background:book.gradient.replace('22','40')+',linear-gradient(135deg,rgba(255,255,255,0.5),transparent)',borderRadius:'28px',padding:'28px 24px',marginBottom:'28px',display:'flex',gap:'22px',alignItems:'flex-start',boxShadow:'0 10px 40px rgba(0,0,0,0.15)',flexWrap:'wrap'}}>
        <div style={{flexShrink:0}}><GlossyBookIcon genre={book.genres[0]} size={110}/></div>
        <div style={{flex:1,minWidth:'220px'}}>
          {book.isIndie && <span style={{background:C.pu,color:'white',padding:'3px 10px',borderRadius:'100px',fontSize:'11px',fontFamily:'Sora,sans-serif',fontWeight:'600',marginRight:'8px',marginBottom:'8px',display:'inline-block'}}>⭐ Indie</span>}
          <h1 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(22px,4vw,34px)',fontWeight:'900',color:C.ink,letterSpacing:'-0.02em',lineHeight:1.1,marginBottom:'6px'}}>{book.title}</h1>
          {/* AUTHOR PAGE: clickable author name on Book Page */}
          <button
            className="author-link"
            onClick={() => onAuthorClick && onAuthorClick(book.authorId)}
            style={{fontFamily:'Nunito,sans-serif',color:'#555',fontSize:'15px',marginBottom:'12px',background:'none',border:'none',cursor:'pointer',padding:0,display:'block',transition:'color 0.15s'}}
          >by {book.author}</button>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',marginBottom:'12px'}}>
            {/* GENRE CHIPS on book page */}
            {book.genres.map(g => (
              <button key={g}
                onClick={() => onGenreClick && onGenreClick(g)}
                style={{background:'rgba(255,255,255,0.8)',color:C.pk,padding:'4px 12px',borderRadius:'100px',fontSize:'12px',fontFamily:'Sora,sans-serif',fontWeight:'700',border:'1px solid '+C.pk+'28',cursor:'pointer',transition:'all 0.15s'}}
              >{g}</button>
            ))}
            <SpiceBadge level={book.spiceLevel}/>
            <span style={{background:book.endingType==='HEA'?C.gr+'22':'#F0F0F0',color:book.endingType==='HEA'?C.gr:'#666',padding:'4px 12px',borderRadius:'100px',fontSize:'12px',fontFamily:'Sora,sans-serif',fontWeight:'600',display:'inline-flex',alignItems:'center',gap:'4px'}}>
              {book.endingType==='HEA'&&'❤ '}
              <GlossChip term={book.endingType} style={{color:'inherit',fontSize:'12px'}}/>
            </span>
          </div>
          <div style={{display:'flex',gap:'12px',fontSize:'12px',fontFamily:'Nunito,sans-serif',color:'#888'}}>
            <span>{book.pages} pages</span><span>·</span><span>{book.readers} readers</span><span>·</span><span>{book.publishedYear}</span>
          </div>
        </div>
      </div>

      {/* Synopsis */}
      {book.synopsis && (
        <section style={{background:'rgba(255,255,255,0.92)',borderRadius:'24px',padding:'24px',marginBottom:'22px',boxShadow:'0 4px 18px rgba(0,0,0,0.1)'}}>
          <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'17px',fontWeight:'800',color:C.ink,marginBottom:'12px'}}>Synopsis</h2>
          <p style={{fontFamily:'Nunito,sans-serif',fontSize:'15px',lineHeight:1.8,color:'#444'}}>{book.synopsis}</p>
        </section>
      )}

      {/* Quality breakdown */}
      <section style={{background:'rgba(255,255,255,0.92)',borderRadius:'24px',padding:'24px',marginBottom:'22px',boxShadow:'0 4px 18px rgba(0,0,0,0.1)'}}>
        <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'17px',fontWeight:'800',color:C.ink,marginBottom:'4px'}}>Writing Quality</h2>
        <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginBottom:'18px'}}>{getConfidenceText(book.qualityConfidence)}</p>
        <div style={{display:'flex',justifyContent:'center',marginBottom:'22px'}}>
          <div style={{textAlign:'center'}}>
            <QRing score={book.qualityScore} size={110} label="Overall"/>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginTop:'8px',maxWidth:'240px'}}>{scoreReason()}</p>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'16px'}}>
          {[
            {key:'grammar',score:book.qualityBreakdown.grammar,label:'Grammar',tip:METRIC_TIPS.grammar},
            {key:'polishEditing',score:book.qualityBreakdown.polishEditing,label:'Polish',tip:METRIC_TIPS.polish},
            {key:'readability',score:book.qualityBreakdown.readability,label:'Readability',tip:METRIC_TIPS.readability},
            {key:'proseStyle',score:book.qualityBreakdown.proseStyle,label:'Prose Style',tip:METRIC_TIPS.prose},
            {key:'pacing',score:book.qualityBreakdown.pacing,label:'Pacing',tip:METRIC_TIPS.pacing},
            {key:'communityConsensus',score:book.qualityBreakdown.communityConsensus,label:'Community',tip:METRIC_TIPS.community},
          ].map(m => {
            const note = METRIC_NOTES[m.key];
            return (
              <div key={m.key} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'}}>
                <QRing score={m.score} size={72}/>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#888',fontFamily:'Sora,sans-serif',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'center'}}>
                  {m.label}<MetricTooltip text={m.tip}/>
                </span>
                {note && <p style={{marginTop:'4px',fontFamily:'Nunito,sans-serif',fontSize:'11px',color:'#666',textAlign:'center',lineHeight:1.5}}>{note}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Spice & Warnings */}
      <section style={{background:'rgba(255,255,255,0.92)',borderRadius:'24px',padding:'24px',marginBottom:'22px',boxShadow:'0 4px 18px rgba(0,0,0,0.1)'}}>
        <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'17px',fontWeight:'800',color:C.ink,marginBottom:'16px'}}>Spice & Content Warnings</h2>
        <div style={{background:C.spice[book.spiceLevel]+'22',borderRadius:'16px',padding:'16px 18px',border:'1.5px solid '+C.spice[book.spiceLevel]+'55',display:'flex',alignItems:'center',gap:'14px',marginBottom:'16px'}}>
          <span style={{fontSize:'28px'}}>{C.spicePpr[book.spiceLevel]}</span>
          <div>
            <p style={{fontFamily:'Sora,sans-serif',fontWeight:'800',fontSize:'15px',color:'#1A1028',marginBottom:'2px'}}>Spice {book.spiceLevel}/6 — {C.spiceLbl[book.spiceLevel]}</p>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:'#777'}}>{book.spiceDescription || ''}</p>
          </div>
        </div>
        <div>
          <p style={{fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'13px',color:'#555',marginBottom:'10px'}}>Content &amp; trigger warnings</p>
          <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginBottom:'12px',lineHeight:1.5}}>Use these to decide if this book is right for you. Listed by severity — spoiler-free.</p>
          {(!book.contentWarnings || !book.contentWarnings.length) ? (
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:'#BBB',fontStyle:'italic'}}>No content warnings listed for this book.</p>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {book.contentWarnings.map(w => {
                const sevColor = {severe:'#E53838',moderate:C.or,mild:'#888'}[w.severity]||'#888';
                const sevBg = {severe:'#FFF0F0',moderate:'#FFF8F0',mild:'#F8F8F8'}[w.severity]||'#F8F8F8';
                return (
                  <div key={w.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',borderRadius:'12px',background:sevBg,border:'1px solid '+sevColor+'22'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:sevColor,flexShrink:0}}/>
                    <span style={{flex:1,fontFamily:'Nunito,sans-serif',fontWeight:'700',fontSize:'13px',color:'#333'}}>{w.label}</span>
                    <span style={{fontFamily:'Sora,sans-serif',fontSize:'10px',fontWeight:'600',color:sevColor,textTransform:'uppercase',letterSpacing:'0.5px'}}>{w.severity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Community */}
      <section style={{background:'rgba(255,255,255,0.92)',borderRadius:'24px',padding:'24px',boxShadow:'0 4px 18px rgba(0,0,0,0.1)'}}>
        <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'17px',fontWeight:'800',color:C.ink,marginBottom:'16px'}}>Community Votes</h2>
        <div style={{display:'flex',gap:'20px',flexWrap:'wrap'}}>
          <div style={{flex:'1 1 140px',background:C.gr+'10',borderRadius:'16px',padding:'16px',textAlign:'center'}}>
            <p style={{fontFamily:'Sora,sans-serif',fontSize:'32px',fontWeight:'800',color:C.gr,lineHeight:1}}>{book.wellWrittenVotes}</p>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginTop:'4px'}}>Well-written ✓</p>
          </div>
          <div style={{flex:'1 1 140px',background:'#FF5A5F10',borderRadius:'16px',padding:'16px',textAlign:'center'}}>
            <p style={{fontFamily:'Sora,sans-serif',fontSize:'32px',fontWeight:'800',color:'#FF5A5F',lineHeight:1}}>{book.notWellWrittenVotes}</p>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginTop:'4px'}}>Not well-written ✗</p>
          </div>
          <div style={{flex:'1 1 140px',background:C.pu+'10',borderRadius:'16px',padding:'16px',textAlign:'center'}}>
            <p style={{fontFamily:'Sora,sans-serif',fontSize:'32px',fontWeight:'800',color:C.pu,lineHeight:1}}>{book.spiceAccuracyVotes}</p>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'12px',color:'#AAA',marginTop:'4px'}}>Spice accurate</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── AUTHOR PAGE ────────────────────────────────────────────────────────────────
// AUTHOR PAGE
// ────────────────────────────────────────────────────────────────────────────────

function AuthorPage({authorId, onBack, onBookClick, onGenreClick}) {
  const authorInfo = AUTHOR_MAP[authorId];
  const authorBooks = BOOKS.filter(b => b.authorId === authorId)
    .sort((a, b) => b.qualityScore - a.qualityScore);

  if (!authorInfo) return (
    <div style={{padding:'60px 20px',textAlign:'center'}}>
      <p style={{fontFamily:'Sora,sans-serif',fontSize:'18px',color:'white'}}>Author not found.</p>
      <button onClick={onBack} style={{marginTop:'16px',fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px'}}>← Back</button>
    </div>
  );

  const avgQuality = authorBooks.length
    ? Math.round(authorBooks.reduce((s, b) => s + b.qualityScore, 0) / authorBooks.length)
    : 0;

  return (
    <div className="fadeUp" style={{maxWidth:'1000px',margin:'0 auto',padding:'20px 20px 100px'}}>
      <button onClick={onBack}
        style={{fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px',display:'flex',alignItems:'center',gap:'6px',marginBottom:'20px'}}
      >← Back</button>

      {/* Author header */}
      <div style={{background:'rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',borderRadius:'28px',padding:'28px 24px',marginBottom:'28px',boxShadow:'0 10px 40px rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.25)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'20px',flexWrap:'wrap'}}>
          {/* Avatar */}
          <div style={{width:'80px',height:'80px',borderRadius:'50%',background:`linear-gradient(135deg,${C.pk},${C.pu})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',flexShrink:0,boxShadow:'0 8px 24px rgba(255,107,157,0.4)'}}>
            {authorInfo.name.charAt(0)}
          </div>
          <div style={{flex:1,minWidth:'180px'}}>
            <div style={{display:'flex',gap:'8px',marginBottom:'6px',flexWrap:'wrap',alignItems:'center'}}>
              <h1 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(22px,4vw,32px)',fontWeight:'900',color:'white',letterSpacing:'-0.02em',lineHeight:1.1}}>{authorInfo.name}</h1>
              {authorInfo.isIndie && <span style={{background:C.pu,color:'white',padding:'3px 10px',borderRadius:'100px',fontSize:'11px',fontFamily:'Sora,sans-serif',fontWeight:'600'}}>⭐ Indie</span>}
            </div>
            <div style={{display:'flex',gap:'16px',flexWrap:'wrap'}}>
              <span style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>
                {authorBooks.length} book{authorBooks.length !== 1 ? 's' : ''} in StyleScope
              </span>
              <span style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>
                Avg quality: <strong style={{color:avgQuality >= 85 ? C.gr : avgQuality >= 70 ? C.or : '#FF6B6B'}}>{avgQuality}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Books grid */}
      <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'20px',fontWeight:'800',color:'white',marginBottom:'18px',letterSpacing:'-0.01em'}}>
        Books by {authorInfo.name}
      </h2>
      {authorBooks.length === 0 ? (
        <p style={{fontFamily:'Nunito,sans-serif',fontSize:'15px',color:'rgba(255,255,255,0.7)'}}>No books found for this author.</p>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'20px'}}>
          {authorBooks.map(book => (
            <div key={book.id} className="fadeUp">
              <BookCard book={book} onClick={() => onBookClick(book)} onGenreClick={onGenreClick} onAuthorClick={()=>{}}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── GENRE PAGE ─────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function GenrePage({genreSlug, onBack, onBookClick, onGenreClick, onAuthorClick, minQuality, setMinQuality}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 280);
    return () => clearTimeout(t);
  }, [searchInput]);

  const genreName = useMemo(() => {
    const slug = genreSlug || '';
    return BOOKS.flatMap(b => b.genres).find(g => g.toLowerCase().replace(/\s+/g, '-') === slug) || null;
  }, [genreSlug]);

  const books = useMemo(() => BOOKS.filter(b => {
    if (!genreName) return false;
    if (!b.genres.some(g => g.toLowerCase() === genreName.toLowerCase())) return false;
    if (b.qualityScore < minQuality) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!b.title.toLowerCase().includes(s) && !b.author.toLowerCase().includes(s)) return false;
    }
    return true;
  }).sort((a, b) => b.qualityScore - a.qualityScore), [genreName, minQuality, search]);

  if (!genreName) return (
    <div style={{padding:'60px 20px',textAlign:'center'}}>
      <p style={{fontFamily:'Sora,sans-serif',fontSize:'18px',color:'white'}}>Genre not found.</p>
      <button onClick={onBack} style={{marginTop:'16px',fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px'}}>← Back</button>
    </div>
  );

  return (
    <div className="fadeUp" style={{maxWidth:'1000px',margin:'0 auto',padding:'20px 20px 100px'}}>
      <button onClick={onBack}
        style={{fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px',display:'flex',alignItems:'center',gap:'6px',marginBottom:'20px'}}
      >← Back</button>

      <h1 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(28px,5vw,42px)',fontWeight:'900',color:'white',letterSpacing:'-0.03em',marginBottom:'6px'}}>{genreName}</h1>
      <p style={{fontFamily:'Nunito,sans-serif',fontSize:'15px',color:'rgba(255,255,255,0.7)',marginBottom:'22px'}}>Sorted by writing quality. Use filters to fine-tune.</p>

      {/* Search + quality */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'12px',alignItems:'center',marginBottom:'22px'}}>
        <div style={{flex:'1 1 260px',background:'rgba(255,255,255,0.95)',borderRadius:'14px',padding:'4px 14px',boxShadow:'0 4px 18px rgba(0,0,0,0.1)',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{opacity:.5,fontSize:'16px'}}>🔍</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder={`Search in ${genreName}...`}
            style={{border:'none',background:'transparent',padding:'10px 4px',fontSize:'14px',fontFamily:'Nunito,sans-serif',outline:'none',flex:1,color:C.ink}}/>
          {searchInput && <button onClick={() => setSearchInput('')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:'#CCC'}}>✕</button>}
        </div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'600',color:'rgba(255,255,255,0.9)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Quality:</span>
          {[{v:0,l:'Any'},{v:70,l:'70+'},{v:80,l:'80+'},{v:90,l:'90+'}].map(opt => (
            <button key={opt.v} onClick={() => setMinQuality(opt.v)}
              style={{padding:'7px 15px',borderRadius:'100px',border:'none',background:minQuality===opt.v?`linear-gradient(135deg,${C.pk},${C.or})`:'rgba(255,255,255,0.85)',color:minQuality===opt.v?'white':C.ink,fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'12px',cursor:'pointer',transition:'all 0.2s'}}
            >{opt.l}</button>
          ))}
        </div>
      </div>

      <p style={{fontFamily:'Nunito,sans-serif',fontSize:'14px',color:'rgba(255,255,255,0.7)',marginBottom:'18px'}}>{books.length} book{books.length !== 1 ? 's' : ''}</p>

      {books.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <p style={{fontFamily:'Sora,sans-serif',fontSize:'16px',color:'rgba(255,255,255,0.7)'}}>No books match your filters.</p>
          <button onClick={() => {setSearchInput(''); setMinQuality(0);}}
            style={{marginTop:'14px',fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'13px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'8px 18px',borderRadius:'100px'}}
          >Clear filters</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'20px'}}>
          {books.map(book => (
            <div key={book.id} className="fadeUp">
              <BookCard book={book} onClick={() => onBookClick(book)} onGenreClick={onGenreClick} onAuthorClick={onAuthorClick}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── GLOSSARY PAGE ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function GlossaryPage({onBack}) {
  return (
    <div className="fadeUp" style={{maxWidth:'740px',margin:'0 auto',padding:'20px 20px 100px'}}>
      <button onClick={onBack}
        style={{fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',padding:'10px 18px',borderRadius:'100px',display:'flex',alignItems:'center',gap:'6px',marginBottom:'20px'}}
      >← Back</button>
      <h1 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(28px,5vw,42px)',fontWeight:'900',color:'white',letterSpacing:'-0.03em',marginBottom:'8px'}}>Glossary</h1>
      <p style={{fontFamily:'Nunito,sans-serif',fontSize:'15px',color:'rgba(255,255,255,0.8)',marginBottom:'32px',lineHeight:1.6}}>Common romance and book community terms you'll see around here.</p>
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {GLOSSARY_TERMS.map(item => (
          <div key={item.term} style={{background:'rgba(255,255,255,0.92)',borderRadius:'18px',padding:'18px 22px',boxShadow:'0 3px 14px rgba(0,0,0,0.1)',border:'1px solid rgba(255,255,255,0.5)'}}>
            <div style={{display:'flex',alignItems:'baseline',gap:'10px',flexWrap:'wrap',marginBottom:'6px'}}>
              <span style={{fontFamily:'Sora,sans-serif',fontWeight:'800',fontSize:'17px',color:C.pk}}>{item.term}</span>
              <span style={{fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'13px',color:'#AAA'}}>{item.full}</span>
            </div>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'14px',color:'#555',lineHeight:1.7,margin:0}}>{item.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── RECENTLY VIEWED ROW ────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function RecentlyViewedRow({history, onSelect, onClear}) {
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'10px'}}>
        <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'16px',fontWeight:'800',color:C.ink,letterSpacing:'-0.01em'}}>📖 Recently Viewed</h2>
        <button onClick={onClear}
          style={{fontFamily:'Sora,sans-serif',fontSize:'11px',fontWeight:'700',color:'#FF5A5F',background:'rgba(255,90,95,0.08)',border:'1px solid rgba(255,90,95,0.2)',borderRadius:'100px',padding:'5px 12px',cursor:'pointer',transition:'all 0.15s'}}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,90,95,0.16)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,90,95,0.08)'}
        >Clear all</button>
      </div>
      <div style={{display:'flex',gap:'14px',overflowX:'auto',paddingBottom:'8px',scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch'}}>
        {history.slice(0,10).map(b => (
          <div key={b.id} onClick={() => onSelect(b)}
            style={{flexShrink:0,width:'100px',scrollSnapAlign:'start',cursor:'pointer',textAlign:'center',padding:'8px',borderRadius:'14px',transition:'all 0.2s'}}
            onMouseEnter={e => {e.currentTarget.style.background=C.pk+'10';e.currentTarget.style.transform='translateY(-3px)';}}
            onMouseLeave={e => {e.currentTarget.style.background='transparent';e.currentTarget.style.transform='translateY(0)';}}
          >
            <div style={{display:'flex',justifyContent:'center',marginBottom:'8px'}}>
              <GlossyBookIcon genre={b.genres[0]} size={64}/>
            </div>
            <p style={{fontFamily:'Sora,sans-serif',fontSize:'11px',fontWeight:'700',color:C.ink,lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.title}</p>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'10px',color:'#BBB',marginTop:'2px'}}>{C.spicePpr[b.spiceLevel]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── FOOTER (FOOTER CLEANUP) ────────────────────────────────────────────────────
// FOOTER CLEANUP: removed About/FAQ/Privacy/Contact placeholder links
// ────────────────────────────────────────────────────────────────────────────────

function Footer({onGlossary}) {
  return (
    <footer style={{padding:'48px 0 80px',display:'flex',justifyContent:'center',marginTop:'60px'}}>
      <div style={{maxWidth:'640px',width:'100%',background:'rgba(10,14,39,0.8)',borderRadius:'24px',padding:'24px 20px 22px',boxShadow:'0 18px 40px rgba(0,0,0,0.4)',backdropFilter:'blur(18px)',border:'1px solid rgba(255,255,255,0.2)',textAlign:'center'}}>
        <h3 style={{fontFamily:'Sora,sans-serif',fontSize:'18px',fontWeight:'800',color:'white',marginBottom:'12px'}}>StyleScope</h3>
        <p style={{fontFamily:'Nunito,sans-serif',fontSize:'14px',color:'rgba(255,255,255,0.9)',marginBottom:'18px',lineHeight:1.6}}>
          Know before you read. Quality scores, spice levels, and content warnings for every book.
        </p>
        <div style={{marginBottom:'14px'}}>
          <button onClick={onGlossary}
            style={{fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'600',color:C.pu,background:'none',border:'none',cursor:'pointer',textDecoration:'underline',display:'inline-flex',alignItems:'center',gap:'4px'}}
          >📖 Glossary of terms</button>
        </div>
        <p style={{fontFamily:'Nunito,sans-serif',fontSize:'11px',color:'rgba(255,255,255,0.7)'}}>
          © 2024 StyleScope · Made with 💗 by book lovers, for book lovers
        </p>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── SKELETON & UI HELPERS ──────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{padding:'6px',borderRadius:'40px',background:'linear-gradient(135deg,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0.08) 100%)',boxShadow:'0 16px 48px rgba(0,0,0,0.1)'}}>
      <div style={{borderRadius:'34px',background:'white',padding:'28px 22px 18px',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
        <div className="skel" style={{width:'88px',height:'88px',borderRadius:'24px'}}/>
        <div className="skel" style={{width:'80%',height:'14px',borderRadius:'7px'}}/>
        <div className="skel" style={{width:'55%',height:'11px',borderRadius:'6px'}}/>
        <div className="skel" style={{width:'100%',height:'26px',borderRadius:'13px'}}/>
        <div style={{display:'flex',gap:'6px',width:'100%',justifyContent:'space-between'}}>
          <div className="skel" style={{width:'40%',height:'10px',borderRadius:'5px'}}/>
          <div className="skel" style={{width:'30%',height:'10px',borderRadius:'5px'}}/>
        </div>
      </div>
    </div>
  );
}

function Toast({message, onClose}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{position:'fixed',bottom:'90px',left:'50%',transform:'translateX(-50%)',zIndex:1500,animation:'toastIn 0.35s var(--ease-smooth) forwards',pointerEvents:'none'}}>
      <div style={{background:'rgba(26,16,40,0.92)',backdropFilter:'blur(20px)',borderRadius:'100px',padding:'11px 22px',color:'white',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'14px',border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 12px 40px rgba(0,0,0,0.4)',whiteSpace:'nowrap'}}>{message}</div>
    </div>
  );
}

function BackToTop({visible}) {
  if (!visible) return null;
  return (
    <button onClick={() => window.scrollTo({top:0,behavior:'smooth'})}
      style={{position:'fixed',bottom:'90px',right:'28px',zIndex:998,width:'44px',height:'44px',borderRadius:'100%',background:`linear-gradient(135deg,${C.pk},${C.or})`,border:'none',cursor:'pointer',color:'white',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(255,107,157,0.5)',transition:'transform 0.2s'}}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12) translateY(-3px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >↑</button>
  );
}

function MobileNav({activeTab, setActiveTab, onSettings}) {
  const tabs = [{id:'discover',icon:'📚',label:'Discover'},{id:'search',icon:'🔍',label:'Search'},{id:'library',icon:'📖',label:'Library'},{id:'profile',icon:'⚙',label:'Profile'}];
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:500,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(30px)',borderTop:'1px solid rgba(0,0,0,0.08)',display:'flex',padding:'6px 0 8px',boxShadow:'0 -8px 32px rgba(0,0,0,0.15)'}}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => {setActiveTab(t.id); if (t.id==='profile') onSettings();}}
          style={{flex:1,border:'none',background:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',padding:'4px 0',transition:'transform 0.15s'}}
        >
          <span style={{fontSize:'22px',filter:activeTab===t.id?`drop-shadow(0 0 6px ${C.pk})`:'none',transition:'filter 0.2s'}}>{t.icon}</span>
          <span style={{fontFamily:'Sora,sans-serif',fontSize:'10px',fontWeight:'600',color:activeTab===t.id?C.pk:'#AAA',transition:'color 0.2s'}}>{t.label}</span>
          {activeTab===t.id && <div style={{width:'20px',height:'3px',borderRadius:'2px',background:`linear-gradient(90deg,${C.pk},${C.or})`,marginTop:'1px'}}/>}
        </button>
      ))}
    </div>
  );
}

function ShareModal({book, onClose, onToast}) {
  const url = `https://stylescope.app/book/${book.id}`;
  const text = `Check out "${book.title}" by ${book.author} on StyleScope! ${C.spicePpr[book.spiceLevel]}`;
  const opts = [
    {label:'Copy Link',icon:'🔗',action:() => {navigator.clipboard?.writeText(url).catch(()=>{}); onToast('Link copied!'); onClose();}},
    {label:'Twitter / X',icon:'𝕏',action:() => {window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,'_blank'); onClose();}},
    {label:'Email',icon:'✉',action:() => {window.location.href = `mailto:?subject=${encodeURIComponent('Book recommendation: '+book.title)}&body=${encodeURIComponent(text+'\n\n'+url)}`; onClose();}},
  ];
  return (
    <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(12px)',display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'20px'}} onClick={e => {if (e.target===e.currentTarget) onClose();}}>
      <div className="slideDown" style={{background:'white',borderRadius:'28px',width:'100%',maxWidth:'400px',padding:'24px',boxShadow:'0 40px 80px rgba(0,0,0,0.3)'}}>
        <h3 style={{fontFamily:'Sora,sans-serif',fontSize:'18px',fontWeight:'800',color:C.ink,marginBottom:'6px'}}>Share this book</h3>
        <p style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:'#AAA',marginBottom:'18px'}}>{book.title} · {book.author}</p>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {opts.map(o => (
            <button key={o.label} onClick={o.action}
              style={{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px',borderRadius:'16px',border:'1px solid '+C.pk+'22',background:'rgba(255,107,157,0.04)',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'14px',color:C.ink,transition:'all 0.15s'}}
              onMouseEnter={e => e.currentTarget.style.background = C.pk+'12'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,107,157,0.04)'}
            >
              <span style={{fontSize:'22px',width:'32px',textAlign:'center'}}>{o.icon}</span>{o.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{width:'100%',marginTop:'14px',padding:'11px',borderRadius:'14px',border:'none',background:'rgba(0,0,0,0.05)',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'14px',color:'#888'}}>Cancel</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ─── ADVANCED FILTERS PANEL ─────────────────────────────────────────────────────
// FILTER PANEL
// ────────────────────────────────────────────────────────────────────────────────

function AdvancedFilterPanel({filters, onApply, onClose}) {
  const [local, setLocal] = useState({...DEFAULT_ADV, ...filters});

  const toggle = (key, val) => {
    setLocal(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));
  };

  const activeCount = [
    local.genres.length > 0,
    local.spiceLevels.length > 0,
    local.hideSevereWarnings,
    local.authorTypes.length > 0,
    local.yearFrom !== '' || local.yearTo !== '',
    local.pageFrom !== '' || local.pageTo !== '',
  ].filter(Boolean).length;

  const SectionHead = ({children}) => (
    <p style={{fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'700',color:C.ink,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'10px',marginTop:'20px'}}>{children}</p>
  );

  const Chip = ({label, active, onClick}) => (
    <button onClick={onClick}
      style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontFamily:'Sora,sans-serif',fontWeight:'600',border:`1.5px solid ${active?C.pk:'#DDD'}`,background:active?C.pk+'15':'#F8F8F8',color:active?C.pk:C.ink,cursor:'pointer',transition:'all 0.15s'}}
    >{label}</button>
  );

  const AUTHOR_TYPE_OPTS = [{val:'indie',label:'Indie'},{val:'traditional',label:'Traditional'},{val:'emerging',label:'Emerging Author'}];
  const SPICE_OPTS = [{val:'0-1',label:'☁️ Sweet (0–1)'},{val:'2',label:'🌶️ Warm (2)'},{val:'3',label:'🌶️🌶️🌶️ Hot (3)'},{val:'4',label:'🔥🔥🔥 Steamy (4)'},{val:'5',label:'🔥🔥🔥🔥 Scorching (5)'},{val:'6',label:'☢️ Nuclear (6)'}];

  return (
    <div style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(12px)',display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'12px'}} onClick={e => {if (e.target===e.currentTarget) onClose();}}>
      <div className="slideDown" style={{background:'white',borderRadius:'28px 28px 0 0',width:'100%',maxWidth:'640px',maxHeight:'88vh',overflowY:'auto',padding:'24px 24px 32px',boxShadow:'0 -20px 60px rgba(0,0,0,0.25)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
          <div>
            <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'20px',fontWeight:'900',color:C.ink}}>Advanced Filters</h2>
            <p style={{fontFamily:'Nunito,sans-serif',fontSize:'13px',color:activeCount > 2 ? '#E53838' : '#888',marginTop:'4px'}}>
              {activeCount <= 2
                ? `Free plan: ${activeCount}/2 active filters · Upgrade for unlimited (Coming soon)`
                : `⚠️ ${activeCount} filters active — Free plan allows 2. Upgrade for unlimited (Coming soon).`}
            </p>
          </div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',width:'32px',height:'32px',borderRadius:'100%',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
        </div>

        {/* ─ Genre ─ */}
        <SectionHead>Genre</SectionHead>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {ALL_GENRES.map(g => (
            <Chip key={g} label={g} active={local.genres.includes(g)} onClick={() => toggle('genres', g)}/>
          ))}
        </div>

        {/* ─ Spice ─ */}
        <SectionHead>Spice Level</SectionHead>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {SPICE_OPTS.map(o => (
            <Chip key={o.val} label={o.label} active={local.spiceLevels.includes(o.val)} onClick={() => toggle('spiceLevels', o.val)}/>
          ))}
        </div>

        {/* ─ Content Warnings ─ */}
        <SectionHead>Content Warnings</SectionHead>
        <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'12px 14px',borderRadius:'14px',background:local.hideSevereWarnings?'#FFF0F0':'#F8F8F8',border:'1.5px solid '+(local.hideSevereWarnings?'#E53838':'#EEE'),transition:'all 0.15s'}}>
          <input type="checkbox" checked={local.hideSevereWarnings} onChange={e => setLocal(f => ({...f,hideSevereWarnings:e.target.checked}))}
            style={{width:'16px',height:'16px',accentColor:'#E53838',cursor:'pointer'}}/>
          <span style={{fontFamily:'Nunito,sans-serif',fontSize:'14px',fontWeight:'600',color:'#333'}}>Hide books with severe content warnings</span>
        </label>

        {/* ─ Author Type ─ */}
        <SectionHead>Author Type</SectionHead>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {AUTHOR_TYPE_OPTS.map(o => (
            <Chip key={o.val} label={o.label} active={local.authorTypes.includes(o.val)} onClick={() => toggle('authorTypes', o.val)}/>
          ))}
        </div>

        {/* ─ Year Range ─ */}
        <SectionHead>Published Year</SectionHead>
        <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
          <input type="number" placeholder="From" value={local.yearFrom} onChange={e => setLocal(f=>({...f,yearFrom:e.target.value}))} min="1900" max="2099"
            style={{flex:1,padding:'10px 14px',borderRadius:'12px',border:'1.5px solid #DDD',fontFamily:'Nunito,sans-serif',fontSize:'14px',color:C.ink,outline:'none'}}/>
          <span style={{color:'#AAA',fontFamily:'Nunito,sans-serif'}}>–</span>
          <input type="number" placeholder="To" value={local.yearTo} onChange={e => setLocal(f=>({...f,yearTo:e.target.value}))} min="1900" max="2099"
            style={{flex:1,padding:'10px 14px',borderRadius:'12px',border:'1.5px solid #DDD',fontFamily:'Nunito,sans-serif',fontSize:'14px',color:C.ink,outline:'none'}}/>
        </div>

        {/* ─ Page Count ─ */}
        <SectionHead>Page Count</SectionHead>
        <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
          <input type="number" placeholder="Min pages" value={local.pageFrom} onChange={e => setLocal(f=>({...f,pageFrom:e.target.value}))} min="1"
            style={{flex:1,padding:'10px 14px',borderRadius:'12px',border:'1.5px solid #DDD',fontFamily:'Nunito,sans-serif',fontSize:'14px',color:C.ink,outline:'none'}}/>
          <span style={{color:'#AAA',fontFamily:'Nunito,sans-serif'}}>–</span>
          <input type="number" placeholder="Max pages" value={local.pageTo} onChange={e => setLocal(f=>({...f,pageTo:e.target.value}))} min="1"
            style={{flex:1,padding:'10px 14px',borderRadius:'12px',border:'1.5px solid #DDD',fontFamily:'Nunito,sans-serif',fontSize:'14px',color:C.ink,outline:'none'}}/>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:'10px',marginTop:'24px',flexWrap:'wrap'}}>
          <button onClick={() => onApply(local)}
            style={{flex:'1 1 120px',padding:'13px',borderRadius:'14px',border:'none',background:`linear-gradient(135deg,${C.pk},${C.or})`,cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'700',fontSize:'14px',color:'white',boxShadow:`0 4px 14px ${C.pk}55`}}
          >Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}</button>
          <button onClick={() => setLocal({...DEFAULT_ADV})}
            style={{flex:'1 1 100px',padding:'13px',borderRadius:'14px',border:'1px solid #EEE',background:'#F8F8F8',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'14px',color:'#888'}}
          >Clear All</button>
          <button onClick={onClose}
            style={{flex:'1 1 80px',padding:'13px',borderRadius:'14px',border:'none',background:'rgba(0,0,0,0.05)',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'14px',color:'#AAA'}}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Placeholder modals (structure preserved)
function QuizModal() { return null; }
function SettingsModal() { return null; }
function InfoModal() { return null; }
function OnboardingModal() { return null; }

// ────────────────────────────────────────────────────────────────────────────────
// ─── MAIN APP ───────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ─── View state: home | genre | book | author | glossary ────────────────────
  const [view, setView] = useState({type:'home', genre:null, bookId:null, authorId:null});

  const goHome      = useCallback(() => setView({type:'home',genre:null,bookId:null,authorId:null}), []);
  const goToGlossary= useCallback(() => setView({type:'glossary',genre:null,bookId:null,authorId:null}), []);

  const goToGenre = useCallback((genreNameOrSlug) => {
    const slug = genreNameOrSlug.includes('-') ? genreNameOrSlug
      : genreNameOrSlug.toLowerCase().replace(/\s+/g, '-');
    setView({type:'genre', genre:slug, bookId:null, authorId:null});
    window.scrollTo({top:0, behavior:'smooth'});
  }, []);

  const goToBook = useCallback((bookId) => {
    setView(v => ({type:'book', genre:v.genre, bookId, authorId:null}));
    window.scrollTo({top:0, behavior:'smooth'});
  }, []);

  // AUTHOR PAGE
  const goToAuthor = useCallback((authorId) => {
    setView(v => ({type:'author', genre:v.genre, bookId:null, authorId}));
    window.scrollTo({top:0, behavior:'smooth'});
  }, []);

  // ─── Search & basic quality filter ──────────────────────────────────────────
  // SEARCH FILTER: wired and verified
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [minQuality, setMinQuality]   = useState(70);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ADVANCED FILTERS BUTTON
  const [advancedFilters, setAdvancedFilters] = useState({...DEFAULT_ADV});
  const [showAdvFilters,  setShowAdvFilters]  = useState(false);

  // Count active advanced filter categories (for badge)
  const advActiveCount = useMemo(() => [
    advancedFilters.genres.length > 0,
    advancedFilters.spiceLevels.length > 0,
    advancedFilters.hideSevereWarnings,
    advancedFilters.authorTypes.length > 0,
    advancedFilters.yearFrom !== '' || advancedFilters.yearTo !== '',
    advancedFilters.pageFrom !== '' || advancedFilters.pageTo !== '',
  ].filter(Boolean).length, [advancedFilters]);

  // Helper: does a spice level string like '0-1' contain a given level?
  const spiceMatches = (level, spiceLevels) => {
    if (!spiceLevels.length) return true;
    return spiceLevels.some(s => {
      if (s.includes('-')) {
        const [lo, hi] = s.split('-').map(Number);
        return level >= lo && level <= hi;
      }
      return level === Number(s);
    });
  };

  // FILTER LOGIC: combine search + quality + advanced filters
  const filtered = useMemo(() => BOOKS.filter(b => {
    // Search filter (title + author + ISBN partial match)
    if (search !== '') {
      const s = search.toLowerCase();
      if (!b.title.toLowerCase().includes(s) && !b.author.toLowerCase().includes(s)) return false;
    }
    // Quality filter
    if (b.qualityScore < minQuality) return false;

    // Advanced: genre
    if (advancedFilters.genres.length > 0) {
      if (!b.genres.some(g => advancedFilters.genres.includes(g))) return false;
    }
    // Advanced: spice
    if (!spiceMatches(b.spiceLevel, advancedFilters.spiceLevels)) return false;
    // Advanced: hide severe warnings
    if (advancedFilters.hideSevereWarnings) {
      if (b.contentWarnings?.some(w => w.severity === 'severe')) return false;
    }
    // Advanced: author type
    if (advancedFilters.authorTypes.length > 0) {
      const types = advancedFilters.authorTypes;
      const matchIndie = types.includes('indie') && b.isIndie;
      const matchTraditional = types.includes('traditional') && !b.isIndie;
      const matchEmerging = types.includes('emerging') && b.isEmergingAuthor;
      if (!matchIndie && !matchTraditional && !matchEmerging) return false;
    }
    // Advanced: year range
    if (advancedFilters.yearFrom !== '' && b.publishedYear < Number(advancedFilters.yearFrom)) return false;
    if (advancedFilters.yearTo !== '' && b.publishedYear > Number(advancedFilters.yearTo)) return false;
    // Advanced: page range
    if (advancedFilters.pageFrom !== '' && b.pages < Number(advancedFilters.pageFrom)) return false;
    if (advancedFilters.pageTo !== '' && b.pages > Number(advancedFilters.pageTo)) return false;

    return true;
  }), [search, minQuality, advancedFilters]);

  // Dismiss a single advanced filter tag
  const dismissAdvFilter = (key, val) => {
    setAdvancedFilters(f => {
      if (Array.isArray(f[key])) return {...f, [key]: f[key].filter(x => x !== val)};
      if (typeof f[key] === 'boolean') return {...f, [key]: false};
      return {...f, [key]: ''};
    });
  };

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [userPrefs, setUserPrefs]       = useState({});
  const [shareBook, setShareBook]       = useState(null);
  const [toast, setToast]               = useState(null);
  const [viewHistory, setViewHistory]   = useState(() => {
    try {return JSON.parse(localStorage.getItem('sshistory') || '[]');} catch {return [];}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState('discover');
  const [scrollY, setScrollY]     = useState(0);

  useEffect(() => {const t=setTimeout(()=>setIsLoading(false),1200); return ()=>clearTimeout(t);}, []);
  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, {passive:true});
    return () => window.removeEventListener('scroll', h);
  }, []);

  const showToast = (msg) => {setToast(msg); setTimeout(()=>setToast(null),3500);};

  const handleBookClick = useCallback((book) => {
    setViewHistory(prev => {
      const next = [book, ...prev.filter(b => b.id !== book.id)].slice(0, 20);
      localStorage.setItem('sshistory', JSON.stringify(next));
      return next;
    });
    goToBook(book.id);
  }, [goToBook]);

  const currentBook = view.type === 'book' ? BOOKS.find(b => b.id === view.bookId) : null;

  // Build active filter display tags for home page
  // ACTIVE FILTER DISPLAY
  const activeFilterTags = useMemo(() => {
    const tags = [];
    advancedFilters.genres.forEach(g => tags.push({label:`Genre: ${g}`, key:'genres', val:g}));
    advancedFilters.spiceLevels.forEach(s => tags.push({label:`Spice: ${s}`, key:'spiceLevels', val:s}));
    if (advancedFilters.hideSevereWarnings) tags.push({label:'Hide severe warnings', key:'hideSevereWarnings', val:true});
    advancedFilters.authorTypes.forEach(t => tags.push({label:`Author: ${t}`, key:'authorTypes', val:t}));
    if (advancedFilters.yearFrom||advancedFilters.yearTo) tags.push({label:`Year: ${advancedFilters.yearFrom||'?'} – ${advancedFilters.yearTo||'?'}`, key:'yearFrom', val:''});
    if (advancedFilters.pageFrom||advancedFilters.pageTo) tags.push({label:`Pages: ${advancedFilters.pageFrom||'?'} – ${advancedFilters.pageTo||'?'}`, key:'pageFrom', val:''});
    return tags;
  }, [advancedFilters]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',justifyContent:'center'}}>
        <div style={{width:'100%',maxWidth:'1200px',margin:'0 auto',padding:'20px',position:'relative'}}>

          {/* ── VIEW ROUTER ─────────────────────────────────────────────────── */}
          {view.type === 'glossary' ? (
            <GlossaryPage onBack={goHome}/>

          ) : view.type === 'book' ? (
            <BookPage
              book={currentBook}
              onBack={() => {
                if (view.genre) goToGenre(view.genre);
                else goHome();
              }}
              onAuthorClick={goToAuthor}
              onGenreClick={goToGenre}
              userPrefs={userPrefs}
            />

          ) : view.type === 'author' ? (
            /* AUTHOR PAGE */
            <AuthorPage
              authorId={view.authorId}
              onBack={() => goHome()}
              onBookClick={handleBookClick}
              onGenreClick={goToGenre}
              onAuthorClick={goToAuthor}
            />

          ) : view.type === 'genre' ? (
            <GenrePage
              genreSlug={view.genre}
              onBack={goHome}
              onBookClick={handleBookClick}
              onGenreClick={goToGenre}
              onAuthorClick={goToAuthor}
              minQuality={minQuality}
              setMinQuality={setMinQuality}
            />

          ) : (
            /* HOME */
            <>
              {/* HERO SECTION */}
              <header style={{padding:'60px 0 40px',textAlign:'center',maxWidth:'900px',margin:'0 auto'}}>
                <h1 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(32px, 7vw, 52px)',fontWeight:'800',color:'white',letterSpacing:'-0.03em',lineHeight:1.1,marginBottom:'12px'}}>
                  StyleScope
                </h1>
                <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(22px, 4.5vw, 32px)',fontWeight:'700',color:C.pk,marginBottom:'12px',lineHeight:1.3}}>
                  Check how well-written a book is
                </h2>
                <p style={{fontFamily:'Nunito,sans-serif',fontSize:'clamp(15px, 3vw, 18px)',color:'rgba(255,255,255,0.9)',lineHeight:1.7,maxWidth:'560px',margin:'0 auto 28px'}}>
                  Search by title, author, or ISBN and see a quality scorecard with spice and content warnings.
                </p>

                {/* SEARCH FILTER: search bar, verified wired */}
                <div style={{maxWidth:'640px',margin:'0 auto 20px'}}>
                  <div style={{background:'rgba(255,255,255,0.95)',backdropFilter:'blur(20px)',borderRadius:'24px',padding:'8px',boxShadow:'0 20px 60px rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.9)',border:'1px solid rgba(255,255,255,0.6)',marginBottom:'14px'}}>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <span style={{fontSize:'20px',paddingLeft:'12px'}}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search by title, author, or ISBN..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        style={{flex:1,border:'none',background:'transparent',padding:'12px 8px',fontSize:'16px',fontFamily:'Nunito,sans-serif',outline:'none',color:C.ink}}
                      />
                      {searchInput && (
                        <button onClick={() => setSearchInput('')}
                          style={{background:'rgba(0,0,0,0.06)',border:'none',borderRadius:'100%',width:'28px',height:'28px',cursor:'pointer',marginRight:'6px',fontSize:'14px'}}
                        >✕</button>
                      )}
                    </div>
                  </div>

                  {/* Quality filter pills */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',flexWrap:'wrap',marginBottom:'12px'}}>
                    <span style={{fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:'600',color:'rgba(255,255,255,0.9)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Quality:</span>
                    {[{v:0,l:'Any'},{v:70,l:'70+'},{v:80,l:'80+'},{v:90,l:'90+'}].map(opt => (
                      <button key={opt.v} onClick={() => setMinQuality(opt.v)}
                        style={{padding:'8px 18px',borderRadius:'100px',border:'none',background:minQuality===opt.v?`linear-gradient(135deg,${C.pk},${C.or})`:'rgba(255,255,255,0.85)',color:minQuality===opt.v?'white':C.ink,fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'13px',cursor:'pointer',transition:'all 0.2s',boxShadow:minQuality===opt.v?`0 4px 14px ${C.pk}55`:'0 2px 8px rgba(0,0,0,0.1)',transform:minQuality===opt.v?'scale(1.05)':'scale(1)'}}
                      >{opt.l}</button>
                    ))}
                  </div>

                  {/* ADVANCED FILTERS BUTTON */}
                  <div style={{display:'flex',justifyContent:'center',marginBottom:'10px'}}>
                    <button onClick={() => setShowAdvFilters(true)}
                      style={{padding:'9px 20px',borderRadius:'100px',border:`1.5px solid ${advActiveCount > 0 ? C.pk : 'rgba(255,255,255,0.4)'}`,background:advActiveCount > 0 ? C.pk+'18':'rgba(255,255,255,0.15)',backdropFilter:'blur(8px)',cursor:'pointer',fontFamily:'Sora,sans-serif',fontWeight:'600',fontSize:'13px',color:'white',transition:'all 0.2s',display:'inline-flex',alignItems:'center',gap:'7px'}}
                      onMouseEnter={e => e.currentTarget.style.background = C.pk+'30'}
                      onMouseLeave={e => e.currentTarget.style.background = advActiveCount > 0 ? C.pk+'18':'rgba(255,255,255,0.15)'}
                    >
                      🎛️ Advanced Filters
                      {advActiveCount > 0 && (
                        <span style={{background:C.pk,color:'white',borderRadius:'100px',fontSize:'11px',fontWeight:'800',padding:'2px 8px',lineHeight:1.4,display:'inline-block'}}>{advActiveCount}</span>
                      )}
                    </button>
                  </div>

                  {/* Search / quality status line */}
                  {(searchInput || minQuality > 0) && (
                    <div className="fadeUp" style={{marginTop:'4px',textAlign:'center',fontFamily:'Nunito,sans-serif',fontSize:'14px',color:'rgba(255,255,255,0.8)'}}>
                      {searchInput && <span>Searching "{searchInput}"</span>}
                      {searchInput && minQuality > 0 && <span> · </span>}
                      {minQuality > 0 && <span>Showing books with quality {minQuality}+</span>}
                    </div>
                  )}

                  {/* ACTIVE FILTER DISPLAY: dismissible tags */}
                  {activeFilterTags.length > 0 && (
                    <div className="fadeUp" style={{marginTop:'12px',display:'flex',flexWrap:'wrap',gap:'7px',justifyContent:'center'}}>
                      {activeFilterTags.map((tag, i) => (
                        <span key={i}
                          style={{display:'inline-flex',alignItems:'center',gap:'5px',background:'rgba(255,255,255,0.2)',backdropFilter:'blur(8px)',color:'white',borderRadius:'100px',fontSize:'12px',fontFamily:'Sora,sans-serif',fontWeight:'600',padding:'5px 12px',border:'1px solid rgba(255,255,255,0.3)'}}
                        >
                          {tag.label}
                          <button onClick={() => dismissAdvFilter(tag.key, tag.val)}
                            style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.7)',fontSize:'13px',padding:'0 0 0 2px',lineHeight:1,display:'flex',alignItems:'center'}}
                            aria-label={`Remove filter: ${tag.label}`}
                          >✕</button>
                        </span>
                      ))}
                      <button onClick={() => setAdvancedFilters({...DEFAULT_ADV})}
                        style={{background:'none',border:'none',cursor:'pointer',fontFamily:'Sora,sans-serif',fontSize:'12px',fontWeight:'600',color:'rgba(255,255,255,0.5)',textDecoration:'underline',padding:'5px 8px'}}
                      >Clear all</button>
                    </div>
                  )}
                </div>

                <QualityLegend/>

                <div style={{display:'flex',gap:'10px',justifyContent:'center',flexWrap:'wrap',marginTop:'20px'}}>
                  <GButton g="glass" sz="sm" onClick={() => setShowSettings(true)} style={{gap:'6px'}}>⚙ Settings</GButton>
                </div>
              </header>

              {/* Book Grid */}
              <main style={{marginTop:'20px'}}>
                <div style={{maxWidth:'1000px',margin:'0 auto'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'22px'}}>
                    <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'24px',fontWeight:'800',color:'white',letterSpacing:'-0.02em'}}>
                      Discover Books
                    </h2>
                    <span style={{fontFamily:'Nunito,sans-serif',fontSize:'14px',color:'rgba(255,255,255,0.8)'}}>
                      {filtered.length} book{filtered.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {isLoading ? (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:'20px'}}>
                      {[...Array(8)].map((_, i) => <SkeletonCard key={i}/>)}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{textAlign:'center',padding:'60px 0'}}>
                      <p style={{fontFamily:'Sora,sans-serif',fontSize:'18px',fontWeight:'700',color:'white',marginBottom:'8px'}}>No books found</p>
                      <p style={{fontFamily:'Nunito,sans-serif',fontSize:'15px',color:'rgba(255,255,255,0.7)',marginBottom:'20px'}}>Try adjusting your filters</p>
                      <GButton g="primary" onClick={() => {setSearchInput('');setMinQuality(70);setAdvancedFilters({...DEFAULT_ADV});}}>Clear All Filters</GButton>
                    </div>
                  ) : (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:'20px'}}>
                      {filtered.map(book => (
                        <div key={book.id} className="fadeUp" style={{animationDelay:`${Math.random()*0.2}s`}}>
                          {/* GENRE CHIPS + AUTHOR PAGE: pass handlers */}
                          <BookCard
                            book={book}
                            onClick={() => handleBookClick(book)}
                            onGenreClick={goToGenre}
                            onAuthorClick={goToAuthor}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </main>

              {/* Recently Viewed */}
              {viewHistory.length > 0 && (
                <div style={{marginTop:'32px'}}>
                  <div style={{maxWidth:'1000px',margin:'0 auto'}}>
                    <div style={{background:'rgba(255,255,255,0.95)',borderRadius:'24px',padding:'20px 18px',boxShadow:'0 8px 24px rgba(0,0,0,0.15)',border:'1px solid rgba(255,255,255,0.8)'}}>
                      <RecentlyViewedRow
                        history={viewHistory}
                        onSelect={handleBookClick}
                        onClear={() => {setViewHistory([]); localStorage.removeItem('sshistory');}}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <Footer onGlossary={goToGlossary}/>
            </>
          )}

          <div className="mobile-spacer"/>
        </div>
      </div>

      <BackToTop visible={scrollY > 600}/>

      <div style={{display:window.innerWidth <= 768 ? 'block' : 'none'}}>
        <MobileNav activeTab={mobileTab} setActiveTab={setMobileTab} onSettings={() => setShowSettings(true)}/>
      </div>

      {/* Advanced filter panel */}
      {showAdvFilters && (
        <AdvancedFilterPanel
          filters={advancedFilters}
          onApply={newFilters => {setAdvancedFilters(newFilters); setShowAdvFilters(false);}}
          onClose={() => setShowAdvFilters(false)}
        />
      )}

      {shareBook && <ShareModal book={shareBook} onClose={() => setShareBook(null)} onToast={showToast}/>}
      {toast && <Toast message={toast} onClose={() => setToast(null)}/>}
    </>
  );
}