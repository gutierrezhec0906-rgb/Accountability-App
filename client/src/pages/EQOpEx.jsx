import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
import { generateEQReport } from '../utils/eqReport';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logPointEvent, calculateScore } from '../utils/scoring';
import { compressImage } from '../utils/image';
import { SQDIP_META, SQDIP_ORDER, letterCells, letterGridSize, daysInMonth } from '../utils/sqdipLetters';

const SCALE_LABELS = {
  1: { label: 'Rarely',    desc: 'This behavior is absent or reactive. Others would not recognize it as a strength. Immediate focus needed.' },
  2: { label: 'Sometimes', desc: 'Visible in low-stakes moments but breaks down under pressure or when it costs something. Inconsistent.' },
  3: { label: 'Often',     desc: 'Practiced intentionally but not yet automatic. You catch yourself after the fact more than in the moment.' },
  4: { label: 'Usually',   desc: 'Reliable across most situations, including difficult ones. Others notice and trust it. Minor blind spots remain.' },
  5: { label: 'Always',    desc: 'Deeply embedded. You demonstrate it when hard, teach it to others, and it shapes how your team operates.' },
};

function ScaleButton({ n, selected, onClick, isLast }) {
  const [hovered, setHovered] = useState(false);
  const isActive = n <= selected;
  const color = isActive ? '#0d9488' : hovered ? '#0f2044' : '#e2e8f0';
  const textColor = isActive || hovered ? 'white' : '#94a3b8';

  // Shift tooltip left for the last button so it doesn't overflow viewport
  const tooltipLeft = isLast ? 'auto' : '50%';
  const tooltipRight = isLast ? 0 : 'auto';
  const tooltipTransform = isLast ? 'none' : 'translateX(-50%)';
  const arrowLeft = isLast ? 'auto' : '50%';
  const arrowRight = isLast ? 12 : 'auto';
  const arrowTransform = isLast ? 'none' : 'translateX(-50%)';

  return (
    <div style={{ position: 'relative' }}>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)',
          left: tooltipLeft, right: tooltipRight, transform: tooltipTransform,
          background: '#0f2044', color: 'white', borderRadius: 10, padding: '8px 12px', zIndex: 100,
          width: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#99f6e4', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {n} — {SCALE_LABELS[n].label}
          </p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.45 }}>
            {SCALE_LABELS[n].desc}
          </p>
          <div style={{ position: 'absolute', bottom: -6, left: arrowLeft, right: arrowRight, transform: arrowTransform, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #0f2044' }} />
        </div>
      )}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: 34, height: 34, borderRadius: '50%', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
          border: `2px solid ${color}`, background: isActive ? '#0d9488' : hovered ? '#0f2044' : 'transparent',
          color: textColor, transition: 'all 0.15s' }}>
        {n}
      </button>
    </div>
  );
}

// Real-life guide text for each question — keyed as `${dimensionId}-${questionIndex}`
const EQ_GUIDES = {
  'self-awareness-0': {
    what: 'You notice how you are feeling in the moment — before it affects your words or actions.',
    example: 'During a heated project review, you catch yourself feeling defensive as your ideas are challenged. Instead of snapping back, you name it internally: "I\'m feeling threatened right now." That pause is self-awareness in action.',
    low: 'You only realize you were frustrated after the meeting is over, or when a colleague tells you that you seemed upset.',
    high: 'You can say mid-conversation, "I notice I\'m getting tense — give me a second," and adjust your tone before the situation escalates.',
  },
  'self-awareness-1': {
    what: 'You know which specific situations, words, or people tend to provoke a strong reaction in you — and why.',
    example: 'You know that last-minute scope changes make you anxious. So when a client calls Friday at 4pm with new requests, you recognize the spike of stress immediately and have a planned response ready instead of reacting impulsively.',
    low: 'You frequently say things like "I don\'t know why I got so upset" or "They just push my buttons."',
    high: 'You can tell a direct report: "When deadlines are moved without notice, I tend to get short. If you need to flag a delay, give me some lead time and I\'ll handle it much better."',
  },
  'self-awareness-2': {
    what: 'You actively invite honest input about how others experience you — and you use it.',
    example: 'After a quarterly business review, you ask your manager: "Was there anything in how I presented that landed poorly with the exec team?" You take the answer seriously, even if it\'s uncomfortable.',
    low: 'You avoid asking for feedback, or only ask people who you know will say positive things.',
    high: 'You have a habit of a brief debrief after important interactions: "What went well, what would you have done differently?" and you document patterns you hear repeatedly.',
  },
  'self-awareness-3': {
    what: 'You have a clear, honest picture of where you excel and where you still have gaps — without excessive self-criticism or overconfidence.',
    example: 'You know you are excellent at building relationships and driving alignment, but struggle with detailed data analysis. So you delegate the financial modeling to someone stronger in that area and focus your energy on stakeholder communication.',
    low: 'You either overestimate your abilities (leading to avoidable mistakes) or underestimate them (holding back when you should step up).',
    high: 'In a talent conversation, you can say: "My strength is energizing teams through change. My growth area is patience with slow decision-making processes — I\'m working on it."',
  },

  'self-regulation-0': {
    what: 'Under stress, conflict, or tight deadlines, you remain composed and solution-focused rather than reactive.',
    example: 'A key team member calls in sick the morning of a major client presentation. Instead of expressing panic or frustration in front of the team, you calmly assess what can be adjusted, reassign tasks, and communicate the revised plan with confidence.',
    low: 'When things go wrong, your stress is visible — raised voice, short responses, or visible frustration that affects the team\'s own anxiety level.',
    high: 'Team members say they feel calmer just having you in the room during a crisis, because your steadiness sets the tone.',
  },
  'self-regulation-1': {
    what: 'When something triggers a strong emotional reaction, you pause and process before you respond.',
    example: 'A peer publicly criticizes your team\'s performance in a leadership meeting. Instead of firing back immediately, you take a breath, let them finish, and respond with: "I appreciate you raising this — can we set time to dig into the data together?"',
    low: 'You send reactive emails you later regret, interrupt people when you disagree, or make decisions in anger that you have to walk back.',
    high: 'You have personal rules: never send an email when you\'re emotionally activated. You draft it, wait an hour, then review before sending.',
  },
  'self-regulation-2': {
    what: 'When priorities shift, processes change, or plans fall apart, you adjust without becoming rigid or destabilized.',
    example: 'Mid-project, leadership changes the success metrics and reduces your budget. Instead of resisting or complaining, you reframe the constraint as a design challenge, update the plan, and re-energize your team around the new direction.',
    low: 'You get stuck on "but that\'s not how we planned it" or visibly disengage when the goalposts move.',
    high: 'When a reorganization announcement comes, you are the first to ask: "What does success look like in the new structure?" and begin adapting your team immediately.',
  },
  'self-regulation-3': {
    what: 'Even in difficult stretches — setbacks, conflict, or boring grind phases — you model optimism and forward momentum.',
    example: 'Your team has missed two consecutive targets. In the Monday standup, instead of dwelling on the misses, you acknowledge the reality briefly and pivot to: "Here\'s what I believe we can control this week." Your attitude shapes what they believe is possible.',
    low: 'When things are hard, your attitude visibly drags — you vent frequently, express cynicism about the company, or bring a low-energy presence that the team absorbs.',
    high: 'People come to you when they are demoralized because your perspective consistently helps them see a path forward without dismissing the difficulty.',
  },

  'motivation-0': {
    what: 'When you hit setbacks, rejection, or slow progress, you stay engaged and continue pushing forward.',
    example: 'A proposal you worked on for three weeks gets rejected by the client. You\'re disappointed, but within a day you\'re analyzing what to improve and building a stronger follow-up version — not because someone pushed you, but because you genuinely want to get it right.',
    low: 'Setbacks cause you to disengage, become passive, or wait for someone else to reinvigorate the effort.',
    high: 'People describe you as someone who "doesn\'t stay down long" — your recovery time after failures is noticeably fast.',
  },
  'motivation-1': {
    what: 'You set goals that stretch you beyond your comfort zone and pursue them with visible energy.',
    example: 'Rather than targeting the same safe sales number as last year, you set a goal 30% higher and break it into weekly milestones. You block time proactively to work toward it — not just when you feel like it.',
    low: 'You tend to set conservative targets that are easy to hit, or you set ambitious goals but fade once early momentum stalls.',
    high: 'Your goals make some people around you uncomfortable because of how high you set the bar — and you regularly hit them anyway.',
  },
  'motivation-2': {
    what: 'You proactively look for better ways to do your work — not because you\'re told to, but because you want to.',
    example: 'After completing a project, you run a brief post-mortem not to comply with a process, but because you genuinely want to know what slowed you down and what you can do faster next time. You apply that learning to the next project without being asked.',
    low: 'You do the job well but rarely ask "how could this be even better?" unless it\'s part of a formal review cycle.',
    high: 'You regularly bring unsolicited ideas to your manager: "I was thinking about our onboarding process — here\'s a change that could cut ramp time in half."',
  },
  'motivation-3': {
    what: 'Your personal commitment to the work raises the standard for people around you — they work harder because you do.',
    example: 'When your team is hitting a slow patch, you don\'t give a speech — you put in visible extra effort, solve a hard problem in front of them, and the energy shifts. They match your level because you model what "fully committed" looks like.',
    low: 'Your engagement level is consistent but doesn\'t visibly raise the bar for others. You do your part without creating a pull effect on the team.',
    high: 'Team members say things like "I didn\'t want to be the one who gave up when they were still going" — your commitment creates social proof that raises the group\'s standard.',
  },

  'empathy-0': {
    what: 'When someone is speaking, you give them your full attention — you are not internally formulating your response while they are still talking.',
    example: 'A team member comes to you frustrated about a workload issue. Instead of jumping to solutions, you ask follow-up questions, make eye contact, and summarize what you heard before offering anything: "It sounds like the real issue is that you feel like your capacity isn\'t being respected — is that right?"',
    low: 'You frequently finish people\'s sentences, jump to solutions before they\'re done explaining, or check your phone or screen while others are talking.',
    high: 'People leave conversations with you feeling genuinely heard — even when you disagree with them or cannot give them what they asked for.',
  },
  'empathy-1': {
    what: 'Before making decisions that affect others, you think through how they will feel — not just what is logically optimal.',
    example: 'Before announcing a role change that benefits the organization, you think: "This person has been in this position for 8 years — they\'ll feel displaced even if the new role is technically a promotion. How do I frame this conversation?" You plan accordingly.',
    low: 'You make sound logical decisions but are often surprised by how people react emotionally — "I didn\'t think it would be a big deal."',
    high: 'People describe you as someone who "gets people" — your decisions are both analytically sound and emotionally intelligent in how they\'re structured and communicated.',
  },
  'empathy-2': {
    what: 'You recognize that different people need to hear things differently — and you adjust your style to fit the person, not just the message.',
    example: 'With your analytical direct report, you lead with data when giving feedback. With your more relationship-oriented colleague, you lead with connection and context. Same message, different delivery — and both land well.',
    low: 'You communicate in the way that works for you and expect others to adapt. You\'re consistent but not always effective with people who are wired differently.',
    high: 'You can shift between direct/blunt and warm/narrative in the same meeting depending on who you\'re addressing — and it feels natural, not performative.',
  },
  'empathy-3': {
    what: 'You pick up on team dynamics, unspoken tension, or drops in engagement — before they become visible problems.',
    example: 'During a team standup, no one is making jokes or cross-talking like usual. You notice the shift and pull aside two people afterward: "The energy felt different today — is everything okay?" You surface a festering conflict between two team members before it blows up.',
    low: 'You\'re often the last to know about interpersonal tension on your team, or you notice it only after it has already affected performance or caused someone to resign.',
    high: 'You treat team energy as a leading indicator, the same way you treat pipeline as a leading indicator for revenue — you monitor it proactively and act early.',
  },

  'social-skills-0': {
    what: 'People at every level — your reports, peers, and senior leaders — feel confident that you will do what you say, tell the truth, and treat them fairly.',
    example: 'You follow up on every commitment you make, even small ones. When you can\'t deliver, you say so proactively before the deadline. Over time, people stop double-checking your work because they know you won\'t let it slip.',
    low: 'You are well-liked, but people still hedge when relying on you — they confirm twice, add buffer time, or keep a backup plan because they\'re not fully certain you\'ll come through.',
    high: 'Your reputation travels ahead of you. People who haven\'t worked with you directly already trust you based on what others have said.',
  },
  'social-skills-1': {
    what: 'When two people or groups are in conflict, you step in and move them toward resolution — without taking sides or escalating.',
    example: 'Two team leads are blaming each other for a missed handoff. Instead of picking a side or ignoring it, you bring them together: "I want to understand both perspectives, and then I want us to agree on a process so this doesn\'t happen again." You leave with a signed-off process, not just a truce.',
    low: 'You avoid conflict when possible, or when you do engage, you tend to side with one party, which increases rather than resolves tension.',
    high: 'When people are locked in conflict, they often ask you to mediate — not because it\'s your job, but because they trust your ability to keep it fair and move it forward.',
  },
  'social-skills-2': {
    what: 'When you speak — in meetings, emails, or one-on-ones — people understand your point and feel compelled to act on it.',
    example: 'You can walk into a room of skeptical stakeholders and, in 10 minutes, shift their position — not by overwhelming them with data, but by connecting the data to something they care about. You know what motivates your audience and you lead with that.',
    low: 'Your content is solid but people sometimes walk away unsure of what you were asking for, or your updates take longer than needed because you struggle to frame the core point first.',
    high: 'Your presentations and memos get used as internal templates because of how clearly and persuasively they are structured.',
  },
  'social-skills-3': {
    what: 'The teams you lead or participate in consistently outperform — because you create an environment where people collaborate, hold each other accountable, and bring their best.',
    example: 'On a cross-functional team you led, people who previously never worked together began proactively helping each other outside of formal meetings. The team finished ahead of schedule, not because of extra hours, but because the collaboration removed friction and duplication.',
    low: 'Teams you are on function adequately but rarely achieve the level of cohesion where people go beyond their defined responsibilities to help each other.',
    high: 'People compete to be on teams you lead — not because of your title, but because working with you makes them better and the outcome is usually excellent.',
  },
};

const EQ_SUGGESTED_ACTIONS = {
  'self-awareness': [
    'Keep a daily 3-minute emotion journal — write one emotion you noticed and what triggered it',
    'After each significant meeting, ask yourself: "How was I feeling, and did it affect how I showed up?"',
    'Request specific feedback from two colleagues on one blind spot you suspect you have',
    'Create a personal "trigger list" — document 3 situations that reliably change your behavior and why',
  ],
  'self-regulation': [
    'Establish a personal rule: draft any reactive email, wait 30 minutes, then review before sending',
    'Practice a 5-second breathing pause before responding in tense conversations',
    'Identify your top stress signal (e.g. raised shoulders, faster speech) and use it as a stop cue',
    'After a moment you regret, write down what you would do differently — make it a learning ritual',
  ],
  'motivation': [
    'Set one stretch goal per quarter that makes you slightly uncomfortable — track weekly progress',
    'Run a 15-minute post-project debrief focused only on "what could we improve?" — apply one finding',
    'Block 30 minutes each Friday to review what you accomplished and what still energizes you about the work',
    'Identify one person on your team you can inspire this month through visible commitment on a shared goal',
  ],
  'empathy': [
    'In your next 5 one-on-ones, listen fully before speaking — summarize what you heard before responding',
    'Before a difficult conversation, write down how the other person likely feels about the situation',
    'Identify one team member with a different communication style and practice adapting your approach for 30 days',
    'At the start of each week, do a 2-minute "team pulse check" — ask one person how they are really doing',
  ],
  'social-skills': [
    'Make one specific commitment per week and follow up publicly — build your reliability reputation deliberately',
    'Identify one ongoing conflict or tension in your team and schedule a structured mediation conversation',
    'Before your next presentation, write down the top concern of each key stakeholder and address it explicitly',
    'Introduce one team norm that encourages cross-functional help — recognize publicly when it happens',
  ],
};

const EQ_DEFAULT_DUE_DAYS = 90;

const eqDimensions = [
  { id: 'self-awareness', label: 'Self-Awareness',  icon: '🪞', desc: 'Understanding your emotions and their impact',         questions: ['I recognize my emotional states in real-time','I understand my triggers and how they affect my behavior','I seek feedback to understand my blind spots','I know my strengths and development areas clearly'] },
  { id: 'self-regulation',label: 'Self-Regulation', icon: '🎛️', desc: 'Managing your emotions and impulses effectively',       questions: ['I stay calm under pressure and in conflict','I think before reacting in tense situations','I adapt my approach when things change unexpectedly','I maintain a positive attitude in challenging situations'] },
  { id: 'motivation',     label: 'Motivation',      icon: '🔥', desc: 'Internal drive toward goals beyond external rewards',   questions: ['I maintain enthusiasm even when facing obstacles','I set challenging goals and pursue them with energy','I continuously look for ways to improve','I inspire others through my own commitment'] },
  { id: 'empathy',        label: 'Empathy',          icon: '❤️', desc: 'Understanding and sharing the feelings of others',      questions: ['I actively listen without planning my response',"I consider others' emotions before making decisions",'I adapt my communication style to different people',"I can sense the team's morale and address it proactively"] },
  { id: 'social-skills',  label: 'Social Skills',   icon: '🤝', desc: 'Managing relationships and inspiring others',           questions: ['I build trust with people at all levels','I resolve conflicts constructively and quickly','I communicate clearly and persuasively','I build high-performing collaborative teams'] },
];

const opexChecklist = [
  { category: 'Process Excellence',     items: ['Standard work documented and followed','KPIs are visible and reviewed daily','Process variation is measured and reduced','Value stream mapping completed and updated'] },
  { category: 'Continuous Improvement', items: ['Kaizen events conducted quarterly','Employee ideas captured and implemented','Lessons learned are shared across teams','PDCA cycle is actively used for problems'] },
  { category: 'Leadership Behaviors',   items: ['Daily gemba walks completed','Coaching conversations held weekly','Recognition given frequently and specifically','Accountability conversations handled promptly'] },
  { category: 'Customer Focus',         items: ['Voice of customer captured monthly','Customer complaint root causes addressed','First-time quality metrics tracked','On-time delivery performance monitored'] },
];

function calcDimAvg(scores, dimId, qCount) {
  const vals = Array.from({ length: qCount }, (_, i) => scores[`${dimId}-${i}`] || 0).filter(Boolean);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
}

function formatDate(val) {
  if (!val) return '';
  const d = val.toDate ? val.toDate() : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreBar({ value, max = 5 }) {
  const pct = (value / max) * 100;
  const color = value >= 4 ? '#0d9488' : value >= 3 ? '#f59e0b' : value > 0 ? '#ef4444' : '#e2e8f0';
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 9999, height: 6, flex: 1 }}>
      <div style={{ height: 6, borderRadius: 9999, background: color, width: `${pct}%`, transition: 'width 0.4s' }} />
    </div>
  );
}

function QuestionGuide({ guideKey }) {
  const [open, setOpen] = useState(false);
  const guide = EQ_GUIDES[guideKey];
  if (!guide) return null;
  return (
    <div style={{ width: '100%', marginTop: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 0', color: '#0d9488', fontSize: '0.72rem', fontWeight: 700,
        }}
      >
        <span style={{
          fontSize: '0.55rem', display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.18s',
        }}>▶</span>
        {open ? 'Hide guide' : 'What does this mean?'}
      </button>

      {open && (
        <div style={{
          marginTop: 6, borderRadius: 10, overflow: 'hidden',
          border: '1px solid #ccfbf1', background: '#f0fdf4',
        }}>
          {/* What it means */}
          <div style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid #ccfbf1' }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.68rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What this means</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#1e293b', lineHeight: 1.55 }}>{guide.what}</p>
          </div>
          {/* Day-to-day example */}
          <div style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid #ccfbf1', background: 'white' }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.68rem', fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real-life example</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#334155', lineHeight: 1.55, fontStyle: 'italic' }}>{guide.example}</p>
          </div>
          {/* Low vs High */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: '0.6rem 0.875rem', borderRight: '1px solid #ccfbf1' }}>
              <p style={{ margin: '0 0 3px', fontSize: '0.68rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⬇ Scoring low looks like</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{guide.low}</p>
            </div>
            <div style={{ padding: '0.6rem 0.875rem' }}>
              <p style={{ margin: '0 0 3px', fontSize: '0.68rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⬆ Scoring high looks like</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{guide.high}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SQDIP_COLORS = { green: '#16a34a', red: '#dc2626' };

// One letter card — a pixel-grid glyph made of clickable day-squares.
// Clicking a square cycles: empty → green → red → empty.
function SqdipLetterCard({ letterKey, label, days, cellStatus, onToggleDay }) {
  const meta = SQDIP_META[letterKey];
  const { rows, cols } = letterGridSize(letterKey);
  const cells = letterCells(letterKey, days);
  const cellByPos = {};
  cells.forEach(c => { cellByPos[`${c.row}-${c.col}`] = c; });

  const greenCount = Object.values(cellStatus).filter(v => v === 'green').length;
  const redCount = Object.values(cellStatus).filter(v => v === 'red').length;
  const filled = greenCount + redCount;

  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10, borderLeft: `4px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>{label}</h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{filled}/{days} logged</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, maxWidth: cols * 34 }}>
        {Array.from({ length: rows }).flatMap((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const cell = cellByPos[`${row}-${col}`];
            if (!cell) return <div key={`${row}-${col}`} style={{ aspectRatio: '1' }} />;
            const status = cellStatus[cell.day];
            const bg = status ? SQDIP_COLORS[status] : '#f1f5f9';
            return (
              <button key={`${row}-${col}`} onClick={() => onToggleDay(letterKey, cell.day)}
                title={`Day ${cell.day}${status ? ` — ${status === 'green' ? 'On target' : 'Issue'}` : ' — click to log'}`}
                style={{
                  aspectRatio: '1', borderRadius: 3, border: status ? 'none' : '1px solid #e2e8f0',
                  background: bg, cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.55rem', fontWeight: 700, color: status ? 'rgba(255,255,255,0.85)' : '#94a3b8',
                  transition: 'background 0.15s',
                }}>
                {cell.day}
              </button>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        <span><span style={{ color: SQDIP_COLORS.green }}>●</span> {greenCount} on target</span>
        <span><span style={{ color: SQDIP_COLORS.red }}>●</span> {redCount} issues</span>
      </div>
    </div>
  );
}

export default function EQOpEx() {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('eq');
  const [eqScores, setEqScores] = useState({});
  const [opexChecks, setOpexChecks] = useState({});
  const [opexFindings, setOpexFindings] = useState({});
  const [opexArea, setOpexArea] = useState('');
  const [opexExpandedItem, setOpexExpandedItem] = useState(null);
  const [opexHistory, setOpexHistory] = useState([]);
  const [opexExpandedAudit, setOpexExpandedAudit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState(null);

  // SQDIP Board state — which letters are active (max 5, all 5 by default),
  // label overrides for I/P (Inventory↔Cost, People↔Productivity), and the
  // current month's day-by-day green/red status per letter.
  const [sqdipEnabled, setSqdipEnabled] = useState({ S: true, Q: true, D: true, I: true, P: true });
  const [sqdipLabels, setSqdipLabels] = useState({});
  const [sqdipCells, setSqdipCells] = useState({ S: {}, Q: {}, D: {}, I: {}, P: {} });

  // Personal Development Plan state
  const [pdpAreas, setPdpAreas] = useState(null); // null = not yet initialized
  const [pdpActions, setPdpActions] = useState({}); // { dimId: [{action, responsible, dueDate}] }
  const [savingPdp, setSavingPdp] = useState(false);
  const [savedPdp, setSavedPdp] = useState(null); // existing saved PDP from Firestore

  // EQ history sidebar
  const [eqHistory, setEqHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [saveLabel, setSaveLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const history = (data.eqHistory || []).slice().reverse();
          setEqHistory(history);
          setOpexHistory(data.opexAudits || []);
          if (data.eqDevPlan) setSavedPdp(data.eqDevPlan);

          const board = data.sqdipBoard;
          const currentMonthKey = new Date().toISOString().slice(0, 7);
          if (board && board.month === currentMonthKey) {
            setSqdipEnabled(board.enabled || { S: true, Q: true, D: true, I: true, P: true });
            setSqdipLabels(board.labels || {});
            setSqdipCells(board.cells || { S: {}, Q: {}, D: {}, I: {}, P: {} });
          } else if (board) {
            // New month — keep the user's letter/label config, but start a fresh grid.
            setSqdipEnabled(board.enabled || { S: true, Q: true, D: true, I: true, P: true });
            setSqdipLabels(board.labels || {});
          }
        }
      } catch (e) { console.error(e); setLoadError(true); }
    }
    load();
  }, [currentUser]);

  async function persistSqdip(next) {
    if (!currentUser) return;
    const monthKey = new Date().toISOString().slice(0, 7);
    const board = {
      month: monthKey,
      enabled: next.enabled ?? sqdipEnabled,
      labels: next.labels ?? sqdipLabels,
      cells: next.cells ?? sqdipCells,
    };
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { sqdipBoard: board }, { merge: true });
    } catch { toast.error('Could not save SQDIP Board'); }
  }

  function toggleSqdipLetter(key) {
    const activeCount = Object.values(sqdipEnabled).filter(Boolean).length;
    const turningOn = !sqdipEnabled[key];
    if (turningOn && activeCount >= 5) return toast.error('Maximum of 5 letters on the board');
    if (!turningOn && activeCount <= 1) return toast.error('Keep at least one letter active');
    const next = { ...sqdipEnabled, [key]: turningOn };
    setSqdipEnabled(next);
    persistSqdip({ enabled: next });
  }

  function toggleSqdipLabel(key) {
    const meta = SQDIP_META[key];
    if (!meta.altLabel) return;
    const current = sqdipLabels[key] || meta.defaultLabel;
    const next = { ...sqdipLabels, [key]: current === meta.defaultLabel ? meta.altLabel : meta.defaultLabel };
    setSqdipLabels(next);
    persistSqdip({ labels: next });
  }

  function toggleSqdipDay(letterKey, day) {
    const current = sqdipCells[letterKey]?.[day];
    const nextStatus = !current ? 'green' : current === 'green' ? 'red' : undefined;
    const nextLetterCells = { ...(sqdipCells[letterKey] || {}) };
    if (nextStatus) nextLetterCells[day] = nextStatus; else delete nextLetterCells[day];
    const next = { ...sqdipCells, [letterKey]: nextLetterCells };
    setSqdipCells(next);
    persistSqdip({ cells: next });
  }

  async function saveEQ() {
    if (!currentUser) return toast.error('Not logged in');
    const now = new Date();
    const nextTest = new Date(now);
    nextTest.setDate(nextTest.getDate() + 60);
    const label = saveLabel.trim() || `Assessment — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    setSaving(true);
    try {
      const dimResults = eqDimensions.map(d => ({
        id: d.id, label: d.label, icon: d.icon,
        avg: calcDimAvg(eqScores, d.id, d.questions.length),
      }));
      const scored = dimResults.filter(d => d.avg > 0);
      const overall = scored.length ? +(scored.reduce((a, d) => a + d.avg, 0) / scored.length).toFixed(1) : 0;
      const strongest = [...dimResults].filter(d => d.avg > 0).sort((a, b) => b.avg - a.avg)[0];
      const weakest   = [...dimResults].filter(d => d.avg > 0).sort((a, b) => a.avg - b.avg)[0];
      const newRecord = {
        id: now.getTime().toString(),
        label,
        scores: eqScores,
        dimResults,
        overall,
        strongest: strongest?.label || '',
        weakest:   weakest?.label  || '',
        nextTestDate: nextTest.toISOString().slice(0, 10),
        savedAt: now.toISOString(),
      };
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { eqHistory: arrayUnion(newRecord) }, { merge: true });

      // Award 3 pts if no EQ assessment in the last 90 days
      const ninetyDaysAgoStr = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const recentEQ = (eqHistory).filter(r => (r.savedAt || '').slice(0, 10) >= ninetyDaysAgoStr);
      if (recentEQ.length === 0) {
        const { awarded, capReached } = await logPointEvent(currentUser.uid, {
          points: 3,
          toolLabel: 'EQ Assessment',
          reason: 'Completed Emotional Intelligence assessment (3-month window)',
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          toast.success('+3 pts — EQ Assessment complete!', { duration: 4000 });
        } else if (capReached) {
          toast.success('Assessment saved! (daily point cap reached — score unchanged)', { duration: 4000 });
        } else {
          toast.success('Assessment saved!');
        }
      } else {
        toast.success('Assessment saved! (points already awarded within the last 90 days)');
      }

      setLastSavedRecord(newRecord);
      setEqHistory(h => [newRecord, ...h]);
      setSaveLabel('');
      setShowLabelInput(false);
    } catch (e) {
      console.error(e);
      toast.error('Save failed: ' + e.message, { duration: 6000 });
    }
    setSaving(false);
  }

  async function savePdp() {
    if (!currentUser) return toast.error('Not logged in');
    const allActions = Object.values(pdpActions).flat().filter(a => a.action.trim());
    const MIN_PER_AREA = 2;
    const areasOk = pdpAreas && pdpAreas.every(dimId => {
      const filled = (pdpActions[dimId] || []).filter(a => a.action.trim()).length;
      return filled >= MIN_PER_AREA;
    });
    if (!areasOk) {
      return toast.error('Add at least 2 actions for each focus area to earn the points.', { duration: 4000 });
    }
    setSavingPdp(true);
    try {
      const now = new Date().toISOString();
      const plan = { areas: pdpAreas, actions: pdpActions, savedAt: now };
      await setDoc(doc(db, 'users', currentUser.uid), { eqDevPlan: plan }, { merge: true });
      setSavedPdp(plan);

      // Award +2 pts if no PDP saved in the last 90 days
      const ninetyDaysAgoStr = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const lastPdpDate = savedPdp?.savedAt?.slice(0, 10) || '';
      if (!lastPdpDate || lastPdpDate < ninetyDaysAgoStr) {
        const { awarded, capReached } = await logPointEvent(currentUser.uid, {
          points: 2,
          toolLabel: 'EQ Development Plan',
          reason: 'Completed EQ Personal Development Plan with 4+ improvement actions',
        });
        if (awarded) {
          await calculateScore(currentUser.uid);
          toast.success('+2 pts — EQ Development Plan saved!', { duration: 4000 });
        } else if (capReached) {
          toast.success('Plan saved! (daily point cap reached — score unchanged)', { duration: 4000 });
        } else {
          toast.success('Development plan saved!');
        }
      } else {
        toast.success('Development plan updated! (points already awarded within the last 90 days)');
      }
    } catch (e) {
      console.error(e);
      toast.error('Save failed: ' + e.message, { duration: 6000 });
    }
    setSavingPdp(false);
  }

  function initPdp() {
    // If a plan was already saved, load it exactly as-is so no actions are lost
    if (savedPdp?.areas && savedPdp?.actions) {
      setPdpAreas(savedPdp.areas);
      setPdpActions(savedPdp.actions);
      return;
    }

    // First time: pick the 2 lowest-scoring dimensions and pre-fill with suggestions
    const latest = eqHistory[0];
    let weakAreas;
    if (latest?.dimResults) {
      weakAreas = [...latest.dimResults]
        .filter(d => d.avg > 0)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 2)
        .map(d => d.id);
    } else {
      weakAreas = ['self-awareness', 'self-regulation'];
    }
    const defaultDue = new Date(Date.now() + EQ_DEFAULT_DUE_DAYS * 86400000).toISOString().split('T')[0];
    const userName = userProfile?.displayName || currentUser?.displayName || 'Me';
    const initialActions = {};
    weakAreas.forEach(dimId => {
      const suggestions = EQ_SUGGESTED_ACTIONS[dimId] || [];
      initialActions[dimId] = suggestions.slice(0, 2).map(s => ({ action: s, responsible: userName, dueDate: defaultDue }));
    });
    setPdpAreas(weakAreas);
    setPdpActions(initialActions);
  }

  function addPdpAction(dimId) {
    const defaultDue = new Date(Date.now() + EQ_DEFAULT_DUE_DAYS * 86400000).toISOString().split('T')[0];
    const userName = userProfile?.displayName || currentUser?.displayName || 'Me';
    setPdpActions(prev => ({
      ...prev,
      [dimId]: [...(prev[dimId] || []), { action: '', responsible: userName, dueDate: defaultDue }],
    }));
  }

  function updatePdpAction(dimId, idx, field, value) {
    setPdpActions(prev => {
      const updated = [...(prev[dimId] || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [dimId]: updated };
    });
  }

  function removePdpAction(dimId, idx) {
    setPdpActions(prev => {
      const updated = (prev[dimId] || []).filter((_, i) => i !== idx);
      return { ...prev, [dimId]: updated };
    });
  }

  async function saveOpexAudit() {
    if (!currentUser) return toast.error('Not logged in');
    if (!opexArea.trim()) return toast.error('Please enter the area being audited');
    if (checkedOpex === 0) return toast.error('Complete at least one checklist item before saving');
    const dupName = opexArea.trim().toLowerCase();
    if (opexHistory.some(a => a.area.toLowerCase() === dupName)) {
      return toast.error(`An audit for "${opexArea.trim()}" already exists. Use a different name or delete the existing one first.`);
    }
    setSaving(true);
    try {
      const findingsNoImages = Object.fromEntries(
        Object.entries(opexFindings).filter(([, v]) => v.note).map(([k, v]) => [k, { note: v.note }])
      );
      const record = {
        id: Date.now().toString(),
        area: opexArea.trim(),
        score: opexPct,
        checked: checkedOpex,
        total: totalOpex,
        checks: { ...opexChecks },
        findings: findingsNoImages,
        date: new Date().toISOString(),
      };
      const updated = [record, ...opexHistory].slice(0, 50);
      await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
      setOpexHistory(updated);
      toast.success(`Audit saved — ${opexPct}% for "${opexArea}"`);
    } catch (e) { toast.error('Save failed: ' + e.message); }
    setSaving(false);
  }

  function loadOpexAudit(record) {
    setOpexChecks(record.checks || {});
    setOpexFindings(record.findings || {});
    setOpexArea(record.area || '');
    setOpexExpandedItem(null);
    toast.success(`Loaded audit: ${record.area}`);
  }

  async function deleteOpexAudit(id) {
    const updated = opexHistory.filter(a => a.id !== id);
    await setDoc(doc(db, 'users', currentUser.uid), { opexAudits: updated }, { merge: true });
    setOpexHistory(updated);
    toast.success('Audit deleted');
  }

  function resetOpexAudit() {
    setOpexChecks({});
    setOpexFindings({});
    setOpexArea('');
    setOpexExpandedItem(null);
  }

  function setOpexFinding(key, field, value) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), [field]: value } }));
  }

  async function handleOpexImageUpload(key, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('Image is too large (max 25 MB)'); return; }
    try {
      const { preview } = await compressImage(file);
      setOpexFinding(key, 'image', preview);
    } catch {
      if (file.size > 5 * 1024 * 1024) { toast.error("Couldn't process this photo. Try a smaller one."); return; }
      const reader = new FileReader();
      reader.onload = ev => setOpexFinding(key, 'image', ev.target.result);
      reader.readAsDataURL(file);
    }
  }

  function removeOpexImage(key) {
    setOpexFindings(f => ({ ...f, [key]: { ...(f[key] || {}), image: null } }));
  }

  function setScore(dimId, qIdx, val) { setEqScores(s => ({ ...s, [`${dimId}-${qIdx}`]: val })); }
  function toggleOpex(cat, idx) { const k = `${cat}-${idx}`; setOpexChecks(c => ({ ...c, [k]: !c[k] })); }

  function loadRecord(record) {
    setEqScores(record.scores || {});
    setSelectedRecord(record.id);
    toast.success(`Loaded: ${record.label}`);
  }

  async function deleteRecord(recordId) {
    if (!currentUser) return;
    const updated = eqHistory.filter(r => r.id !== recordId);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { eqHistory: updated }, { merge: true });
      setEqHistory(updated);
      if (selectedRecord === recordId) setSelectedRecord(null);
      toast.success('Assessment deleted.');
    } catch {
      toast.error('Could not delete — try again.');
    }
  }

  const eqResults = eqDimensions.map(dim => {
    const avg = calcDimAvg(eqScores, dim.id, dim.questions.length);
    return { ...dim, avg };
  });
  const avgEQ = eqResults.filter(d => d.avg > 0).length
    ? +(eqResults.filter(d => d.avg > 0).reduce((a, d) => a + d.avg, 0) / eqResults.filter(d => d.avg > 0).length).toFixed(1)
    : 0;

  const totalOpex = opexChecklist.reduce((a, c) => a + c.items.length, 0);
  const checkedOpex = Object.values(opexChecks).filter(Boolean).length;
  const opexPct = Math.round((checkedOpex / totalOpex) * 100);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader icon="💡" title="EQ & OpEx Tools — Accountability in Action" subtitle="Emotional Intelligence self-assessment and Operational Excellence checklist" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[{ id: 'eq', label: '💡 EQ Assessment' }, { id: 'opex', label: '⚙️ OpEx Checklist' }, { id: 'sqdip', label: '🗓️ SQDIP Board' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeTab === t.id ? '#0f2044' : '#f1f5f9', color: activeTab === t.id ? 'white' : '#475569' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'eq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Saved assessments history panel */}
          {(eqHistory.length > 0 || loadError) && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', background: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>📋 Saved Assessments</span>
                <span style={{ color: '#99f6e4', fontSize: '0.78rem', fontWeight: 700 }}>{eqHistory.length} record{eqHistory.length !== 1 ? 's' : ''}</span>
              </div>
              {loadError && (
                <div style={{ padding: '0.75rem 1.25rem', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, margin: 0 }}>⚠️ Could not load history — check Firestore rules for the users collection.</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
                {eqHistory.map((rec, idx) => {
                  const isSelected = selectedRecord === rec.id;
                  const overall = rec.overall || 0;
                  const nextDate = rec.nextTestDate
                    ? new Date(rec.nextTestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;
                  const today = new Date(); today.setHours(0,0,0,0);
                  const daysUntil = rec.nextTestDate ? Math.round((new Date(rec.nextTestDate + 'T00:00:00') - today) / 86400000) : null;
                  const reminderColor = daysUntil !== null && daysUntil <= 0 ? '#ef4444' : daysUntil !== null && daysUntil <= 7 ? '#f59e0b' : '#0d9488';
                  const reminderBg   = daysUntil !== null && daysUntil <= 0 ? '#fef2f2' : daysUntil !== null && daysUntil <= 7 ? '#fefce8' : '#f0fdf4';
                  const reminderText = daysUntil !== null && daysUntil <= 0 ? 'Retake overdue!' : daysUntil !== null ? `Retake in ${daysUntil} days` : null;
                  return (
                    <div key={rec.id} style={{ padding: '1rem 1.25rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: isSelected ? '#f0fdf4' : 'white' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: isSelected ? '#0d9488' : 'var(--text-primary)', flex: 1, marginRight: 8 }}>{rec.label}</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: overall >= 4 ? '#0d9488' : overall >= 3 ? '#f59e0b' : overall > 0 ? '#ef4444' : '#94a3b8' }}>
                          {overall || '—'}<span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>/5</span>
                        </span>
                      </div>
                      {/* Date */}
                      {(rec.savedAt || rec.createdAt) && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>📅 {formatDate(rec.savedAt || rec.createdAt)}</p>
                      )}
                      {/* Dimension bars */}
                      {rec.dimResults && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                          {rec.dimResults.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.68rem', width: 90, color: 'var(--text-muted)', flexShrink: 0 }}>{d.icon} {d.label}</span>
                              <ScoreBar value={d.avg} />
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.avg >= 4 ? '#0d9488' : d.avg >= 3 ? '#f59e0b' : d.avg > 0 ? '#ef4444' : '#94a3b8', width: 24, textAlign: 'right', flexShrink: 0 }}>{d.avg || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Strongest / Weakest tags */}
                      {(rec.strongest || rec.weakest) && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                          {rec.strongest && <span style={{ fontSize: '0.68rem', background: '#f0fdf4', color: '#0d9488', border: '1px solid #0d948830', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>⬆ {rec.strongest}</span>}
                          {rec.weakest   && <span style={{ fontSize: '0.68rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>⬇ {rec.weakest}</span>}
                        </div>
                      )}
                      {/* 60-day reminder */}
                      {nextDate && (
                        <div style={{ background: reminderBg, border: `1px solid ${reminderColor}44`, borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: reminderColor, margin: '0 0 2px' }}>🔔 Next: {nextDate}</p>
                          {reminderText && <p style={{ fontSize: '0.68rem', color: reminderColor, margin: 0, fontWeight: 600 }}>{reminderText}</p>}
                        </div>
                      )}
                      {/* Load + Delete buttons */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <button onClick={() => loadRecord(rec)}
                          style={{ flex: 1, padding: '0.35rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${isSelected ? '#0d9488' : '#e2e8f0'}`, background: isSelected ? '#0d9488' : 'white', color: isSelected ? 'white' : '#64748b', transition: 'all 0.15s' }}>
                          {isSelected ? '✓ Loaded' : 'Load'}
                        </button>
                        <button onClick={() => {
                          if (window.confirm('Delete this assessment? This cannot be undone.')) deleteRecord(rec.id);
                        }}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid #fecaca', background: 'white', color: '#ef4444', transition: 'all 0.15s' }}>
                          🗑 Delete
                        </button>
                      </div>
                      {/* PDF Report button */}
                      <button
                        onClick={() => generateEQReport(rec, userProfile?.displayName || currentUser?.displayName || '', userProfile?.role || '')}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1.5px solid #0f2044', background: '#0f2044', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                        📄 Download Recommendations Report
                      </button>

                      {/* Development plan status badge */}
                      {(() => {
                        const isLatest = idx === 0;
                        const planSavedAfter = savedPdp?.savedAt && rec.savedAt && savedPdp.savedAt >= rec.savedAt;
                        const hasPlan = isLatest && planSavedAfter;
                        const planDate = hasPlan
                          ? new Date(savedPdp.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : null;
                        const totalActions = hasPlan
                          ? Object.values(savedPdp.actions || {}).flat().filter(a => a.action?.trim()).length
                          : 0;

                        if (hasPlan) {
                          return (
                            <div style={{
                              marginTop: 8, borderRadius: 10, overflow: 'hidden',
                              border: '1.5px solid #0d948840',
                              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                            }}>
                              <div style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1.2rem' }}>🏆</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: '#0d9488' }}>Development Plan Complete</p>
                                  <p style={{ margin: 0, fontSize: '0.67rem', color: '#64748b' }}>
                                    {totalActions} action{totalActions !== 1 ? 's' : ''} · Saved {planDate}
                                  </p>
                                </div>
                              </div>
                              {savedPdp.areas?.length > 0 && (
                                <div style={{ padding: '0 0.75rem 0.5rem', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {savedPdp.areas.map(areaId => {
                                    const dim = eqDimensions.find(d => d.id === areaId);
                                    return dim ? (
                                      <span key={areaId} style={{ fontSize: '0.67rem', padding: '2px 7px', borderRadius: 9999, background: '#0d948820', color: '#0d9488', fontWeight: 700 }}>
                                        {dim.icon} {dim.label}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div style={{
                            marginTop: 8, borderRadius: 10, border: '1.5px dashed #e2e8f0',
                            padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: 8,
                            background: '#fafafa',
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>📋</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                                {isLatest ? 'No development plan yet' : 'No plan for this record'}
                              </p>
                              {isLatest && (
                                <button
                                  onClick={() => { initPdp(); document.querySelector('[data-pdp-section]')?.scrollIntoView({ behavior: 'smooth' }); }}
                                  style={{ marginTop: 3, background: 'none', border: 'none', padding: 0, fontSize: '0.67rem', color: '#0d9488', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                                  Build your plan → earn +2 pts
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assessment form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {eqResults.some(d => d.avg > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 4 }}>
                {eqResults.map(dim => (
                  <div key={dim.id} className="stat-tile" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.375rem', marginBottom: 4 }}>{dim.icon}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: dim.avg >= 4 ? '#0d9488' : dim.avg >= 3 ? '#f59e0b' : dim.avg > 0 ? '#ef4444' : '#94a3b8' }}>{dim.avg || '—'}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{dim.label}</div>
                  </div>
                ))}
              </div>
            )}

            {eqDimensions.map(dim => (
              <div key={dim.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.875rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{dim.icon}</span>
                    <div>
                      <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.9375rem' }}>{dim.label}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{dim.desc}</p>
                    </div>
                  </div>
                </div>
                {dim.questions.map((q, i) => (
                  <div key={i} style={{ padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: i < dim.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <p style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{q}</p>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <ScaleButton key={n} n={n} selected={eqScores[`${dim.id}-${i}`] || 0} onClick={() => setScore(dim.id, i, n)} isLast={n === 5} />
                        ))}
                      </div>
                    </div>
                    <QuestionGuide guideKey={`${dim.id}-${i}`} />
                  </div>
                ))}
              </div>
            ))}

            {/* Next Step banner — shown after saving */}
            {lastSavedRecord && (
              <div style={{
                position: 'sticky', bottom: 16, zIndex: 20,
                background: 'linear-gradient(135deg, #0f2044 0%, #0d4f6e 100%)',
                borderRadius: 14, padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                boxShadow: '0 8px 32px rgba(13,148,136,0.25)',
                border: '1.5px solid rgba(153,246,228,0.25)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, color: 'white', fontSize: '0.875rem' }}>Your EQ Report is ready</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(153,246,228,0.85)' }}>Personalized recommendations, strengths & action plan</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => generateEQReport(lastSavedRecord, userProfile?.displayName || currentUser?.displayName || '', userProfile?.role || '')}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem',
                      border: 'none', cursor: 'pointer',
                      background: '#0d9488', color: 'white',
                    }}>
                    Download PDF →
                  </button>
                  <button
                    onClick={() => setLastSavedRecord(null)}
                    style={{
                      padding: '0.5rem 0.65rem', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem',
                      border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                      background: 'transparent', color: 'rgba(255,255,255,0.5)',
                    }}>
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Save area */}
            <div className="card" style={{ padding: '1rem' }}>
              {showLabelInput ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Label (e.g. Q2 2025) — optional"
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEQ()}
                    autoFocus
                  />
                  <button className="btn-primary" onClick={saveEQ} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  <button className="btn-secondary" onClick={() => { setShowLabelInput(false); setSaveLabel(''); }}>Cancel</button>
                </div>
              ) : (
                <button className="btn-primary" onClick={() => {
                  const totalQuestions = eqDimensions.reduce((sum, d) => sum + d.questions.length, 0);
                  const answered = eqDimensions.reduce((sum, d) => sum + d.questions.filter((_, i) => eqScores[`${d.id}-${i}`]).length, 0);
                  if (answered < totalQuestions) {
                    toast.error(`Please complete the full assessment — ${answered} of ${totalQuestions} questions answered.`, { duration: 4000 });
                    return;
                  }
                  setShowLabelInput(true);
                }}>Save Assessment</button>
              )}
            </div>

            {/* ── Personal Development Plan ── */}
            <div className="card" data-pdp-section style={{ overflow: 'hidden', marginTop: 8 }}>
              {/* Header */}
              <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #0f2044 0%, #134e6a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 900, color: 'white', fontSize: '1rem' }}>🌱 EQ Personal Development Plan</p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'rgba(153,246,228,0.85)' }}>Build a 90-day improvement plan on your two weakest areas and earn +2 pts (5 pts total for the quarter)</p>
                </div>
                {!pdpAreas && (
                  <button
                    onClick={initPdp}
                    style={{ padding: '0.5rem 1.1rem', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem', border: 'none', cursor: 'pointer', background: '#0d9488', color: 'white', flexShrink: 0 }}>
                    Build My Plan →
                  </button>
                )}
              </div>

              {/* Existing saved plan notice */}
              {savedPdp && !pdpAreas && (
                <div style={{ padding: '0.75rem 1.25rem', background: '#f0fdf4', borderBottom: '1px solid #ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#0d9488', fontSize: '0.8rem' }}>✓ Plan saved on {new Date(savedPdp.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>You can edit and re-save your plan at any time</p>
                  </div>
                  <button onClick={initPdp} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}>Edit Plan</button>
                </div>
              )}

              {/* Plan builder */}
              {pdpAreas && (
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Progress indicator */}
                  {(() => {
                    const totalFilled = pdpAreas.reduce((sum, dimId) => sum + (pdpActions[dimId] || []).filter(a => a.action.trim()).length, 0);
                    const minNeeded = pdpAreas.length * 2;
                    const ready = totalFilled >= minNeeded;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.875rem', borderRadius: 10, background: ready ? '#f0fdf4' : '#fefce8', border: `1px solid ${ready ? '#0d948840' : '#f59e0b40'}` }}>
                        <span style={{ fontSize: '1.1rem' }}>{ready ? '✅' : '📝'}</span>
                        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: ready ? '#0d9488' : '#b45309' }}>
                          {ready
                            ? `Plan complete — ${totalFilled} actions across ${pdpAreas.length} areas. Ready to save and earn +2 pts.`
                            : `${totalFilled} of ${minNeeded} minimum actions filled in — add at least 2 actions per area to unlock +2 pts.`}
                        </p>
                      </div>
                    );
                  })()}

                  {pdpAreas.map(dimId => {
                    const dim = eqDimensions.find(d => d.id === dimId);
                    const latest = eqHistory[0];
                    const dimScore = latest?.dimResults?.find(d => d.id === dimId)?.avg;
                    const rows = pdpActions[dimId] || [];
                    const suggestions = EQ_SUGGESTED_ACTIONS[dimId] || [];
                    const usedSuggestions = new Set(rows.map(r => r.action));
                    const unusedSuggestions = suggestions.filter(s => !usedSuggestions.has(s));

                    return (
                      <div key={dimId} style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                        {/* Area header */}
                        <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.2rem' }}>{dim?.icon}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 800, color: '#0f2044', fontSize: '0.9rem' }}>{dim?.label}</p>
                            {dimScore && <p style={{ margin: '1px 0 0', fontSize: '0.7rem', color: '#64748b' }}>Current score: <strong style={{ color: dimScore < 3 ? '#ef4444' : '#f59e0b' }}>{dimScore}/5</strong></p>}
                          </div>
                          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 9999, background: '#fef2f2', color: '#ef4444', fontWeight: 700 }}>Focus area</span>
                        </div>

                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 36px', gap: 0, padding: '0.4rem 1rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          {['Improvement Action', 'Responsible', 'Due Date', ''].map((h, i) => (
                            <span key={i} style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                          ))}
                        </div>

                        {/* Action rows */}
                        {rows.map((row, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 36px', gap: 0, padding: '0.5rem 1rem', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                            <input
                              className="input"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', marginRight: 8 }}
                              placeholder="Describe the action…"
                              value={row.action}
                              onChange={e => updatePdpAction(dimId, idx, 'action', e.target.value)}
                            />
                            <input
                              className="input"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', marginRight: 8, background: '#f8fafc', color: '#64748b' }}
                              value={row.responsible}
                              onChange={e => updatePdpAction(dimId, idx, 'responsible', e.target.value)}
                            />
                            <input
                              type="date"
                              className="input"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', marginRight: 8 }}
                              value={row.dueDate}
                              onChange={e => updatePdpAction(dimId, idx, 'dueDate', e.target.value)}
                            />
                            <button
                              onClick={() => removePdpAction(dimId, idx)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✕
                            </button>
                          </div>
                        ))}

                        {/* Footer: add action + suggestions */}
                        <div style={{ padding: '0.75rem 1rem', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button
                            onClick={() => addPdpAction(dimId)}
                            style={{ alignSelf: 'flex-start', padding: '0.35rem 0.875rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, border: '1.5px dashed #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }}>
                            + Add Action
                          </button>
                          {unusedSuggestions.length > 0 && (
                            <div>
                              <p style={{ margin: '0 0 5px', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💡 Suggested actions — click to add</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {unusedSuggestions.map((s, si) => (
                                  <button key={si} onClick={() => {
                                    const defaultDue = new Date(Date.now() + EQ_DEFAULT_DUE_DAYS * 86400000).toISOString().split('T')[0];
                                    const userName = userProfile?.displayName || currentUser?.displayName || 'Me';
                                    setPdpActions(prev => ({
                                      ...prev,
                                      [dimId]: [...(prev[dimId] || []), { action: s, responsible: userName, dueDate: defaultDue }],
                                    }));
                                  }}
                                  style={{ textAlign: 'left', padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.75rem', border: '1px solid #e2e8f0', background: 'white', color: '#475569', cursor: 'pointer', lineHeight: 1.45 }}>
                                    ＋ {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Save button */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      className="btn-primary"
                      onClick={savePdp}
                      disabled={savingPdp}>
                      {savingPdp ? 'Saving…' : '💾 Save Development Plan'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => { setPdpAreas(null); setPdpActions({}); }}>
                      Cancel
                    </button>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Minimum 2 actions per area · +2 pts every 90 days · Due dates default to 90 days from today</p>
                  </div>
                </div>
              )}

              {/* No plan, no builder: show teaser */}
              {!pdpAreas && !savedPdp && (
                <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: '2rem' }}>📋</div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>Turn insights into action</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.55 }}>
                      After completing and saving your EQ assessment, click <strong>Build My Plan</strong> above to auto-generate a 90-day development plan focused on your two weakest areas. Completing the plan with at least 4 actions earns you +2 bonus points (5 pts total for the quarter).
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'opex' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── Left: checklist ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Area input + score card */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: 12 }}>
                <label className="label">Area / Location Being Audited</label>
                <input className="input" value={opexArea} onChange={e => setOpexArea(e.target.value)}
                  placeholder="e.g. Production Floor, Warehouse, Office — Q3 2026…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>OpEx Compliance Score</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444' }}>{opexPct}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 10, marginBottom: 6 }}>
                <div style={{ height: 10, borderRadius: 9999, background: opexPct >= 80 ? '#0d9488' : opexPct >= 60 ? '#f59e0b' : '#ef4444', width: `${opexPct}%`, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{checkedOpex} of {totalOpex} behaviors practiced</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }} onClick={resetOpexAudit}>↺ Reset</button>
                  <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem' }} onClick={saveOpexAudit} disabled={saving}>{saving ? 'Saving…' : '💾 Save Audit'}</button>
                  {(opexArea.trim() || checkedOpex > 0) && (
                    <button style={{ fontSize: '0.78rem', padding: '0.3rem 0.875rem', borderRadius: 9999, fontWeight: 700, border: '1.5px solid #0d9488', background: 'white', color: '#0d9488', cursor: 'pointer' }} onClick={resetOpexAudit}>＋ New Audit</button>
                  )}
                </div>
              </div>
            </div>

            {opexChecklist.map(cat => (
              <div key={cat.category} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', background: '#0f2044' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{cat.category}</span>
                </div>
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  const isExpanded = opexExpandedItem === key;
                  const finding = opexFindings[key] || {};
                  const hasFinding = finding.note || finding.image;
                  return (
                    <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem' }}>
                        <button onClick={() => toggleOpex(cat.category, i)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${opexChecks[key] ? '#0d9488' : '#e2e8f0'}`, background: opexChecks[key] ? '#0d9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s' }}>
                            {opexChecks[key] && '✓'}
                          </div>
                          <span style={{ fontSize: '0.875rem', color: opexChecks[key] ? '#94a3b8' : 'var(--text-secondary)', textDecoration: opexChecks[key] ? 'line-through' : 'none' }}>{item}</span>
                        </button>
                        {hasFinding && !isExpanded && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef9c3', color: '#b45309', border: '1px solid #fde68a', borderRadius: 9999, padding: '1px 7px', flexShrink: 0 }}>
                            {finding.image ? '📎 Photo' : '📝 Note'}
                          </span>
                        )}
                        <button onClick={() => setOpexExpandedItem(isExpanded ? null : key)}
                          title={isExpanded ? 'Collapse' : 'Add finding / photo'}
                          style={{ background: isExpanded ? '#f1f5f9' : 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
                          {isExpanded ? '▲' : '📎'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ margin: '0 1.25rem 0.875rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Finding Details</p>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Finding</label>
                            <textarea className="input" rows={3} style={{ fontSize: '0.825rem', resize: 'vertical' }}
                              placeholder="Describe what was observed, the gap, or the non-conformance…"
                              value={finding.note || ''}
                              onChange={e => setOpexFinding(key, 'note', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Photo Evidence (PNG, JPG, GIF — max 5 MB)</label>
                            {finding.image ? (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={finding.image} alt="Finding" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                <button onClick={() => removeOpexImage(key)}
                                  style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>
                            ) : (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px dashed #cbd5e1', cursor: 'pointer', background: 'white', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                📷 Click to attach photo
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleOpexImageUpload(key, e)} />
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Right: audit history ── */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.125rem' }}>
              <h4 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.9rem' }}>📋 Audit History</h4>
              {opexHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: '1.5rem 0' }}>No audits saved yet. Complete the checklist and click Save Audit.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opexHistory.map(record => {
                    const scoreColor = record.score >= 80 ? '#0d9488' : record.score >= 60 ? '#f59e0b' : '#ef4444';
                    const scoreBg    = record.score >= 80 ? '#f0fdfa' : record.score >= 60 ? '#fffbeb' : '#fef2f2';
                    const isExp = opexExpandedAudit === record.id;
                    const dateStr = new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={record.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.area}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{dateStr}</p>
                          </div>
                          <span style={{ background: scoreBg, color: scoreColor, fontWeight: 800, fontSize: '0.875rem', borderRadius: 8, padding: '2px 10px', border: `1px solid ${scoreColor}33`, flexShrink: 0 }}>{record.score}%</span>
                        </div>
                        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                          <button onClick={() => loadOpexAudit(record)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#0d9488' }}>
                            📂 Load
                          </button>
                          <button onClick={() => setOpexExpandedAudit(isExp ? null : record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#64748b' }}>
                            {isExp ? '▲' : '▼'} Details
                          </button>
                          <button onClick={() => deleteOpexAudit(record.id)}
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            🗑
                          </button>
                        </div>
                        {isExp && (
                          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{record.checked} / {record.total} items completed</p>
                            {Object.keys(record.findings || {}).length > 0 && (
                              <p style={{ margin: 0, color: '#b45309' }}>📝 {Object.keys(record.findings).length} note(s) recorded</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sqdip' && (() => {
        const today = new Date();
        const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const days = daysInMonth(today.getFullYear(), today.getMonth());
        const activeCount = Object.values(sqdipEnabled).filter(Boolean).length;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Config bar */}
            <div className="card" style={{ padding: '1.125rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>🗓️ {monthLabel} · {days} days</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Fill in each day green (on target) or red (issue) — the letter completes as the month goes on.</p>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{activeCount}/5 letters active</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SQDIP_ORDER.map(key => {
                  const meta = SQDIP_META[key];
                  const on = sqdipEnabled[key];
                  const label = sqdipLabels[key] || meta.defaultLabel;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => toggleSqdipLetter(key)}
                        style={{ padding: '0.4rem 0.875rem', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                          background: on ? meta.color : '#f1f5f9', color: on ? 'white' : '#94a3b8' }}>
                        {meta.icon} {label}
                      </button>
                      {meta.altLabel && on && (
                        <button onClick={() => toggleSqdipLabel(key)} title={`Switch to ${label === meta.defaultLabel ? meta.altLabel : meta.defaultLabel}`}
                          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 9999, padding: '2px 6px', fontSize: '0.65rem', cursor: 'pointer', color: '#94a3b8' }}>
                          ⇄
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Letter cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {SQDIP_ORDER.filter(key => sqdipEnabled[key]).map(key => (
                <SqdipLetterCard
                  key={key}
                  letterKey={key}
                  label={sqdipLabels[key] || SQDIP_META[key].defaultLabel}
                  days={days}
                  cellStatus={sqdipCells[key] || {}}
                  onToggleDay={toggleSqdipDay}
                />
              ))}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
