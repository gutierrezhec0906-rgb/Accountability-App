import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import toast from 'react-hot-toast';
import { generateAssessmentReport } from '../utils/assessmentReport';

// ── Assessment data ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'model',    label: 'Set the Bar',            icon: '🧭', color: '#2563eb', bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)', light: '#eff6ff', border: '#bfdbfe', desc: 'Setting personal example and upholding shared values.' },
  { id: 'inspire',  label: 'Spark the Vision',  icon: '🔭', color: '#0d9488', bg: 'linear-gradient(135deg,#134e4a,#0d9488)', light: '#f0fdfa', border: '#99f6e4', desc: 'Painting the future and enlisting others in the dream.' },
  { id: 'challenge',label: 'Improve the Flow',    icon: '⚙️', color: '#d97706', bg: 'linear-gradient(135deg,#78350f,#d97706)', light: '#fffbeb', border: '#fcd34d', desc: 'Seeking innovation and learning from setbacks.' },
  { id: 'enable',   label: 'Enable the Team',     icon: '🤝', color: '#7c3aed', bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)', light: '#fdf4ff', border: '#e9d5ff', desc: 'Fostering collaboration and building capability.' },
  { id: 'encourage',label: 'Winning with Compassion',      icon: '❤️', color: '#e11d48', bg: 'linear-gradient(135deg,#881337,#e11d48)', light: '#fff1f2', border: '#fecdd3', desc: 'Recognizing contributions and celebrating victories.' },
];

const QUESTIONS = [
  {
    id: 1, cat: 'model',
    text: 'I set a personal example of what I expect of others.',
    tools: 'EQ Assessment · Visual Management Board',
    guide: {
      emerging:   'Team members can point to specific instances where your own actions (attendance, deadlines, quality checks) did not match the standard you asked others to meet in the last month.',
      developing: 'You generally follow the standards you set, but have not documented or displayed what "the standard" looks like — expectations live in your head rather than on a board or written list.',
      strong:     'You have a written or visual reference (e.g., a Visual Management Board) showing the standards you hold yourself to, and can cite at least one recent situation where you took the harder, correct action instead of a shortcut.',
      exemplary:  'Your Visual Management Board and personal commitments are visible to the team, updated weekly, and team members independently cite you as the person who "walks the talk" without being asked.',
    },
  },
  {
    id: 2, cat: 'inspire',
    text: 'I talk about future trends that will influence how our work gets done.',
    tools: 'Vision Builder',
    guide: {
      emerging:   'You have not discussed any external trend (technology, market, customer, regulatory) affecting the team\'s work in team meetings over the last quarter.',
      developing: 'You mention industry or technology trends occasionally in passing conversation, but have not connected them to a specific plan or written vision for the team.',
      strong:     'You have used Vision Builder (or an equivalent written exercise) to capture at least one future trend and its implication for the team\'s 3–5 year direction, and have shared it in at least one team setting.',
      exemplary:  'You keep a documented vision updated with current trend data and reference it in planning conversations; team members can repeat the trends back without being prompted.',
    },
  },
  {
    id: 3, cat: 'challenge',
    text: 'I seek out challenging opportunities that test my own skills and abilities.',
    tools: 'DISC Assessment · Career Development',
    guide: {
      emerging:   'You have not taken on a stretch assignment, cross-functional project, or new responsibility outside your comfort zone in the last 6–12 months.',
      developing: 'You have expressed interest in taking on something new but have not yet signed up for or started a specific stretch assignment.',
      strong:     'You have a documented development goal (Career Development or SMART Goals) tied to a specific skill gap identified through a self-assessment like DISC, and are actively working a plan against it.',
      exemplary:  'You have completed at least one significant stretch assignment in the last year, documented the skills gained, and already have a next stretch goal queued in your Career Development plan.',
    },
  },
  {
    id: 4, cat: 'enable',
    text: 'I develop cooperative relationships among the people I work with.',
    tools: 'Mentoring Tracker',
    guide: {
      emerging:   'Team members or peers describe working relationships as transactional or siloed; you have no record of cross-team collaboration efforts.',
      developing: 'You have friendly individual relationships but have not intentionally connected people who don\'t naturally interact (e.g., across shifts, departments, or functions).',
      strong:     'You have logged at least one active mentoring relationship or cross-functional pairing in the Mentoring Tracker, with notes on how it\'s improving collaboration.',
      exemplary:  'Multiple mentoring or cross-team relationships are active and logged, and you can point to a specific conflict or silo that was resolved because of a relationship you intentionally built.',
    },
  },
  {
    id: 5, cat: 'encourage',
    text: 'I praise people for a job well done.',
    tools: 'Feedback Box',
    guide: {
      emerging:   'No recognition entries exist in the Feedback Box in the last 30 days, and team members report not recalling the last time they received specific praise.',
      developing: 'You offer praise verbally in the moment but have not logged or documented it anywhere, so recognition isn\'t visible beyond the individual conversation.',
      strong:     'You have logged 2–3 specific, individualized recognition entries in the Feedback Box in the last month, naming the exact action that was praised.',
      exemplary:  'Recognition entries are logged on a near-weekly basis, each tied to a specific behavior or result, and team members cite the recognition as a reason they stay engaged.',
    },
  },
  {
    id: 6, cat: 'model',
    text: 'I spend time and energy making certain that the people I work with adhere to the principles and standards we have agreed on.',
    tools: 'Visual Management Board · Line of Balance',
    guide: {
      emerging:   'There is no tracking mechanism for team standards; deviations from agreed-upon principles go unaddressed for weeks.',
      developing: 'You address standard violations when they are pointed out by someone else, but do not proactively monitor adherence.',
      strong:     'You maintain a Visual Management Board or Line of Balance reviewed at least weekly, and follow up directly when items turn yellow or red.',
      exemplary:  'The board is reviewed on a set cadence (e.g., daily huddle), overdue items are addressed within 24–48 hours, and the recommitment process is used consistently rather than dismissed.',
    },
  },
  {
    id: 7, cat: 'inspire',
    text: 'I describe a compelling image of what our future could be like.',
    tools: 'Vision Builder',
    guide: {
      emerging:   'You have no written vision statement, and when asked to describe the team\'s future in one sentence, cannot do so.',
      developing: 'You can describe the future informally in conversation but have not written it down or shared it in a team-wide format.',
      strong:     'A vision statement exists in Vision Builder, has been shared with the team at least once, and includes specific, tangible language rather than generic phrases like "be the best."',
      exemplary:  'The vision is documented, printed or displayed, referenced in team meetings, and you can describe it in vivid, specific detail without notes.',
    },
  },
  {
    id: 8, cat: 'challenge',
    text: 'I challenge people to try out new and innovative ways to do their work.',
    tools: 'Lean Toolkit (Kaizen Event Log)',
    guide: {
      emerging:   'No new process ideas or experiments have been logged in the Kaizen Event Log in the last quarter; the team runs the same way it did a year ago.',
      developing: 'You are open to new ideas when someone else brings them, but have not proactively asked anyone to try something different.',
      strong:     'You have initiated at least one Kaizen event or process experiment in the last quarter and asked a specific person by name to lead or try a new method.',
      exemplary:  'Multiple Kaizen events or experiments are active in the log, and at least one team member has been asked by name to pilot a new approach in the last month.',
    },
  },
  {
    id: 9, cat: 'enable',
    text: 'I actively listen to diverse points of view.',
    tools: 'DISC Assessment · Coaching Log',
    guide: {
      emerging:   'Team meetings are dominated by your own talking; when a differing opinion is raised, it is dismissed within the same conversation rather than explored.',
      developing: 'You listen politely to differing views but rarely change a decision or plan based on what was said.',
      strong:     'You have used a tool like DISC to understand how different people communicate, and can cite a specific decision in the last month that changed because of input from someone with a different perspective.',
      exemplary:  'Differing viewpoints are documented in Coaching Log conversations, you actively solicit input from quieter or dissenting voices before finalizing decisions, and can name multiple recent examples of decisions shaped by that input.',
    },
  },
  {
    id: 10, cat: 'encourage',
    text: 'I make it a point to let people know about my confidence in their abilities.',
    tools: 'Coaching Log',
    guide: {
      emerging:   'No coaching conversation in the last month included a direct statement of confidence in an individual\'s ability to handle a specific task or challenge.',
      developing: 'You believe in the team\'s abilities but have not said so directly to individuals in a documented conversation.',
      strong:     'At least one Coaching Log entry in the last month includes a specific statement of confidence tied to a real task (e.g., "told J. she was ready to lead the audit").',
      exemplary:  'Coaching Log entries regularly include confidence-building statements tied to specific, named challenges, and team members can repeat back a specific vote of confidence you gave them recently.',
    },
  },
  {
    id: 11, cat: 'model',
    text: 'I follow through on the promises and commitments that I make.',
    tools: 'Visual Management Board',
    guide: {
      emerging:   'Multiple overdue action items sit in the Visual Management Board without a new commitment date or explanation, and team members can cite a broken promise from you in the last month.',
      developing: 'You follow through on most commitments but have at least one open item that has slipped past its date without a recommitment.',
      strong:     'Overdue items are addressed through the recommitment process within a few days, and you can point to zero unresolved broken promises in the last month.',
      exemplary:  'You have a documented pattern of on-time follow-through, use the recommitment modal consistently when a date is missed, and proactively communicate before a commitment slips rather than after.',
    },
  },
  {
    id: 12, cat: 'inspire',
    text: 'I appeal to others to share an exciting dream of the future.',
    tools: 'Vision Builder',
    guide: {
      emerging:   'The team vision, if it exists, has not been shared or discussed with the team as a group.',
      developing: 'You have shared a vision idea one time but have not invited the team to react to it, add to it, or make it their own.',
      strong:     'You have used Vision Builder to create a vision and held at least one conversation inviting team input or reaction to it.',
      exemplary:  'The vision was built or refined collaboratively, team members can describe it in their own words, and multiple people have referenced "our vision" unprompted in the last quarter.',
    },
  },
  {
    id: 13, cat: 'challenge',
    text: 'I search outside the formal boundaries of my organization for innovative ways to improve what we do.',
    tools: 'Lean Toolkit',
    guide: {
      emerging:   'All process ideas come from inside the current team; no benchmarking visit, outside training, industry article, or external conversation has informed a recent change.',
      developing: 'You occasionally read or hear about outside ideas but have not brought a specific external idea into a Lean Toolkit entry or process change.',
      strong:     'At least one process change or 5S/Kaizen entry in the last quarter can be traced to an idea sourced from outside the immediate team (a benchmark visit, supplier, conference, or another plant).',
      exemplary:  'You have an ongoing habit of bringing external ideas into the Lean Toolkit, and at least two recent process improvements are directly attributable to outside sourcing.',
    },
  },
  {
    id: 14, cat: 'enable',
    text: 'I treat others with dignity and respect.',
    tools: 'EQ Assessment',
    guide: {
      emerging:   'There are documented complaints or repeated informal feedback about you interrupting, dismissing, or speaking condescendingly to team members.',
      developing: 'You are respectful most of the time but have had at least one recent incident (raised voice, public correction, sarcasm) that a team member noted as disrespectful.',
      strong:     'Your EQ Assessment shows solid scores in Empathy and Social Skills, and no incidents of disrespectful treatment have been raised in the last quarter.',
      exemplary:  'You are named by multiple team members, unprompted, as someone who treats people with consistent dignity even during difficult conversations (corrective feedback, conflict, layoffs).',
    },
  },
  {
    id: 15, cat: 'encourage',
    text: 'I make sure that people are creatively rewarded for their contributions to the success of our projects.',
    tools: 'Feedback Box',
    guide: {
      emerging:   'Project completions in the last quarter had no associated recognition or reward — not even a documented verbal thank-you.',
      developing: 'Rewards exist but are generic and identical for everyone (e.g., a standard email), not tailored to what motivates the individual.',
      strong:     'At least one project completion in the last quarter was tied to a specific, individualized reward logged in the Feedback Box beyond a generic thank-you.',
      exemplary:  'You maintain a pattern of individualized, creative recognition tied to project milestones, and can describe what specifically motivates 2–3 different team members differently.',
    },
  },
  {
    id: 16, cat: 'model',
    text: 'I ask for feedback on how my actions affect other people\'s performance.',
    tools: 'EQ Assessment · Feedback Box',
    guide: {
      emerging:   'You have not requested feedback on your own leadership or management style from a peer, direct report, or manager in the last 6 months.',
      developing: 'You are open to feedback when it\'s offered but have not proactively asked for it.',
      strong:     'You have used the Feedback Box to request feedback at least once in the last quarter and can describe one specific change made as a result.',
      exemplary:  'You proactively request feedback on a regular cadence (e.g., quarterly), have documented entries in the Feedback Box, and can point to multiple specific behavior changes made because of what you learned.',
    },
  },
  {
    id: 17, cat: 'inspire',
    text: 'I show others how their long-term interests can be realized by enlisting in a common vision.',
    tools: 'Vision Builder · SMART Goals',
    guide: {
      emerging:   'Team members cannot articulate how the team or organizational vision connects to their own individual career goals.',
      developing: 'You have discussed the vision but have not connected it explicitly to any individual\'s personal or career goals.',
      strong:     'At least one SMART Goal or Career Development conversation explicitly ties an individual\'s goal to the shared team vision.',
      exemplary:  'Multiple team members have documented individual goals explicitly linked to the shared vision, and can explain in their own words how achieving the vision helps them personally.',
    },
  },
  {
    id: 18, cat: 'challenge',
    text: 'I ask "What can we learn?" when things don\'t go as expected.',
    tools: 'Problem Solving (5 Whys / A3)',
    guide: {
      emerging:   'The last time a project or task missed its target, no root-cause analysis (5 Whys, Fishbone, A3) was conducted — the team simply moved to the next task.',
      developing: 'You discuss what went wrong informally but do not use a structured tool to document the root cause or the lesson learned.',
      strong:     'At least one recent miss (in the last quarter) has a completed 5 Whys or A3 entry in the Problem Solving tool with an identified root cause.',
      exemplary:  'Structured root-cause analysis is the default response to misses, multiple entries exist in Problem Solving, and lessons learned are shared with the broader team, not just fixed quietly.',
    },
  },
  {
    id: 19, cat: 'enable',
    text: 'I support the decisions that people make on their own.',
    tools: 'Skills Development · Career Development',
    guide: {
      emerging:   'You routinely override or redo decisions made by team members without discussing it with them first.',
      developing: 'You allow some decisions to stand but second-guess or reverse decisions in areas where you personally feel more comfortable.',
      strong:     'You can cite at least one recent decision (in the last month) made independently by a team member that you let stand, even though you might have chosen differently.',
      exemplary:  'You have a documented pattern (via Skills Development ratings or direct examples) of delegating real decision authority, and team members describe feeling trusted to make calls without needing sign-off on everything.',
    },
  },
  {
    id: 20, cat: 'encourage',
    text: 'I publicly recognize people who exemplify commitment to shared values.',
    tools: 'Leadership Quotes · Feedback Box',
    guide: {
      emerging:   'No public recognition (team meeting shout-out, posted note, group message) tied to a specific value has occurred in the last quarter.',
      developing: 'Recognition happens but only privately (one-on-one), not in front of the team or peer group.',
      strong:     'At least one public recognition in the last month specifically named a value (not just "good job") and was tied to an entry in Feedback Box or a shared Leadership Quote reflection.',
      exemplary:  'Public, values-specific recognition happens on a regular, visible cadence (e.g., a standing agenda item), and team members can name recent examples of peers being recognized this way.',
    },
  },
  {
    id: 21, cat: 'model',
    text: 'I build consensus around a common set of values for running our organization.',
    tools: 'Visual Management Board',
    guide: {
      emerging:   'There is no documented or agreed-upon set of team values or operating principles; when asked, team members give different answers.',
      developing: 'Values exist informally (understood but not written down or discussed as a group), so alignment varies by individual.',
      strong:     'A written set of team values or standards exists (e.g., posted on the Visual Management Board) and was built with team input rather than handed down.',
      exemplary:  'Team values are documented, visible, revisited periodically with the team, and team members can recite them consistently when asked individually.',
    },
  },
  {
    id: 22, cat: 'inspire',
    text: 'I paint the "big picture" of what we aspire to accomplish.',
    tools: 'Vision Builder',
    guide: {
      emerging:   'Team members describe their work only in terms of daily tasks and cannot connect it to a larger organizational goal or purpose.',
      developing: 'You occasionally reference the bigger goal but mostly communicate in terms of immediate tasks and deadlines.',
      strong:     'At least one team communication in the last month connected daily work explicitly to the larger vision documented in Vision Builder.',
      exemplary:  'The connection between daily tasks and the big picture is made routinely (e.g., referenced in most team meetings), and team members can explain how their specific role ladders up to the larger goal.',
    },
  },
  {
    id: 23, cat: 'challenge',
    text: 'I make certain that we set achievable goals, make concrete plans, and establish measurable milestones for the projects and programs that we work on.',
    tools: 'SMART Goals · Line of Balance',
    guide: {
      emerging:   'Projects are tracked with vague deadlines and no measurable milestones; progress is reported as "on track" without supporting data.',
      developing: 'Some goals exist but are missing at least one SMART element — not specific enough, no clear metric, or no real deadline.',
      strong:     'Active SMART Goals exist for current projects with specific, measurable fields filled out, and a Line of Balance or similar milestone tracker shows real progress data.',
      exemplary:  'All active projects have complete SMART Goals and milestone tracking updated on a regular cadence, and you can produce current % completion data on request without checking with someone else first.',
    },
  },
  {
    id: 24, cat: 'enable',
    text: 'I give people a great deal of freedom and choice in deciding how to do their work.',
    tools: 'Skills Development',
    guide: {
      emerging:   'You specify the exact method for completing routine tasks, even for team members rated proficient (4–5) in that skill area.',
      developing: 'You allow some flexibility for experienced team members but still dictate the "how" for most tasks regardless of skill level.',
      strong:     'You reference Skills Development ratings to decide how much autonomy to give — higher-rated skills get more latitude in method, not just outcome.',
      exemplary:  'Autonomy is calibrated and documented by skill level; team members with proficiency ratings of 4+ are explicitly told they can choose their own approach, and can describe a recent instance of exercising that freedom.',
    },
  },
  {
    id: 25, cat: 'encourage',
    text: 'I find ways to celebrate accomplishments.',
    tools: 'Coaching Log · Feedback Box',
    guide: {
      emerging:   'The last major milestone or project completion passed with no acknowledgment beyond moving to the next task.',
      developing: 'Celebrations happen but only for very large wins (end of a major project), not smaller milestones along the way.',
      strong:     'At least one milestone celebration (team lunch, shout-out, note) in the last month is documented in Coaching Log or Feedback Box, tied to a specific accomplishment.',
      exemplary:  'Celebration is a regular practice tied to both small and large milestones, documented consistently, and team members describe celebrations as genuine rather than perfunctory.',
    },
  },
  {
    id: 26, cat: 'model',
    text: 'I am clear about my philosophy of leadership.',
    tools: 'Vision Builder',
    guide: {
      emerging:   'You have no written statement of leadership philosophy and cannot articulate one in under a minute when asked directly.',
      developing: 'You have informal ideas about your leadership approach but have never written them down or shared them with the team.',
      strong:     'A written personal leadership philosophy or vision exists in Vision Builder, covering roughly the next 3–5 years, even if it hasn\'t been widely shared yet.',
      exemplary:  'Your leadership philosophy is written, has been shared with the team at least once, and you can explain specific decisions you\'ve made that were guided by it.',
    },
  },
  {
    id: 27, cat: 'inspire',
    text: 'I speak with genuine conviction about the higher meaning and purpose of our work.',
    tools: 'Mindfulness · Vision Builder',
    guide: {
      emerging:   'You describe the work purely in terms of output, quota, or deadlines, with no mention of a larger purpose in team communications.',
      developing: 'You occasionally reference purpose but the language feels generic (e.g., "we make a difference") without specifics tied to the actual work.',
      strong:     'You have used Mindfulness/self-reflection or Vision Builder to articulate a specific purpose statement, and have communicated it to the team with concrete language at least once recently.',
      exemplary:  'Purpose-driven language is a consistent part of how you communicate, tied to specific outcomes (e.g., "this reduces the defect that caused last year\'s customer complaint"), and team members can repeat the purpose in their own words.',
    },
  },
  {
    id: 28, cat: 'challenge',
    text: 'I experiment and take risks, even when there is a chance of failure.',
    tools: 'Lean Toolkit (Kaizen) · Problem Solving',
    guide: {
      emerging:   'No new approach has been piloted in the last two quarters; every process change waited for outside approval or a mandate before happening.',
      developing: 'You support others\' experiments but have not personally initiated or owned a pilot that could fail.',
      strong:     'At least one Kaizen event or pilot in the last quarter was initiated by you personally, including one that did not fully succeed and was logged as a learning.',
      exemplary:  'You have an ongoing pattern of initiating experiments (multiple Kaizen Event Log entries), openly discuss failed attempts as learning rather than hiding them, and can cite a specific failure that led to a better outcome.',
    },
  },
  {
    id: 29, cat: 'enable',
    text: 'I ensure that people grow in their jobs by learning new skills and developing themselves.',
    tools: 'Training Center · Skills Development · Career Development',
    guide: {
      emerging:   'No team member has completed a training item or updated a skills rating in the last quarter; there is no active Career Development plan for anyone.',
      developing: 'Training happens but is generic and mandatory-only (compliance training), with no individualized development plan tied to a specific skill gap.',
      strong:     'At least one team member has an active, individualized plan in Training Center or Career Development tied to a specific skill gap identified in Skills Development.',
      exemplary:  'Every direct report has a current, individualized development plan with tracked progress, and you can name specific skills each person has gained in the last 6 months.',
    },
  },
  {
    id: 30, cat: 'encourage',
    text: 'I give the members of the team lots of appreciation and support for their contributions.',
    tools: 'Coaching Log · Feedback Box',
    guide: {
      emerging:   'Team members report feeling like their contributions go unnoticed; no appreciation entries exist in Coaching Log or Feedback Box in the last month.',
      developing: 'Appreciation is offered but inconsistently — some team members receive it regularly while others report rarely hearing it.',
      strong:     'Coaching Log or Feedback Box shows appreciation entries for most team members in the last month, not just your usual favorites.',
      exemplary:  'Appreciation and support are distributed consistently across the whole team (documented), and even quieter or lower-visibility contributors have specific, recent examples of being recognized.',
    },
  },
];

const CAT_QUESTIONS = Object.fromEntries(CATEGORIES.map(c => [c.id, QUESTIONS.filter(q => q.cat === c.id)]));

// ── Scoring guide levels ─────────────────────────────────────────
const GUIDE_LEVELS = [
  { key: 'emerging',   label: '1–4  Emerging',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { key: 'developing', label: '5–6  Developing',  color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
  { key: 'strong',     label: '7–9  Strong',      color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'exemplary',  label: '10   Exemplary',   color: '#7c3aed', bg: '#fdf4ff', border: '#e9d5ff' },
];

// ── Scoring guide panel ──────────────────────────────────────────
function ScoringGuide({ question, catColor }) {
  return (
    <div style={{ marginTop: 10, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scoring Guide</span>
        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>Related: {question.tools}</span>
      </div>
      {/* Level rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {GUIDE_LEVELS.map((lvl, i) => (
          <div key={lvl.key} style={{
            padding: '0.75rem',
            background: lvl.bg,
            borderRight: i < 3 ? `1px solid ${lvl.border}` : 'none',
            borderBottom: '0',
          }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: lvl.color, margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {lvl.label}
            </p>
            <p style={{ fontSize: '0.73rem', color: '#374151', margin: 0, lineHeight: 1.55 }}>
              {question.guide[lvl.key]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Radar/Spider chart ───────────────────────────────────────────
function RadarChart({ scores, size = 300 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.34;
  const n = CATEGORIES.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, frac) => ({ x: cx + r * frac * Math.cos(angle(i)), y: cy + r * frac * Math.sin(angle(i)) });
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const axes = CATEGORIES.map((_, i) => ({ from: { x: cx, y: cy }, to: pt(i, 1) }));
  const dataPoints = CATEGORIES.map((c, i) => pt(i, (scores[c.id] || 0) / 60));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
  const ringPath = frac => CATEGORIES.map((_, i) => pt(i, frac)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';

  // Split label into up to 3 lines of ~12 chars each
  function labelLines(label) {
    const words = label.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      if (current && (current + ' ' + w).length > 12) { lines.push(current); current = w; }
      else { current = current ? current + ' ' + w : w; }
    }
    if (current) lines.push(current);
    return lines;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {rings.map(f => <path key={f} d={ringPath(f)} fill="none" stroke="#e2e8f0" strokeWidth="1" />)}
      {axes.map((a, i) => <line key={i} x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke="#e2e8f0" strokeWidth="1" />)}
      <path d={dataPath} fill="rgba(13,148,136,0.15)" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0d9488" stroke="white" strokeWidth="1.5" />)}
      {CATEGORIES.map((c, i) => {
        const lp = pt(i, 1.32);
        const lines = labelLines(c.label);
        const lineH = 13;
        const totalH = lines.length * lineH;
        return (
          <text key={i} x={lp.x} y={lp.y - totalH / 2} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.color}>
            <tspan x={lp.x} dy="0">{c.icon}</tspan>
            {lines.map((ln, li) => <tspan key={li} x={lp.x} dy={lineH}>{ln}</tspan>)}
          </text>
        );
      })}
      {[20, 40, 60].map(v => <text key={v} x={cx + 4} y={cy - r * (v / 60) + 4} fontSize="8" fill="#94a3b8">{v}</text>)}
    </svg>
  );
}

// ── History line chart ───────────────────────────────────────────
function HistoryChart({ history }) {
  const W = 520, H = 200, PL = 36, PR = 16, PT = 12, PB = 40;
  const cW = W - PL - PR, cH = H - PT - PB;
  if (history.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center', padding: '0 2rem' }}>
      Complete at least 2 assessments to see your progress trend.
    </div>
  );
  const px = i => PL + (i / (history.length - 1)) * cW;
  const py = v => PT + cH - (v / 60) * cH;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 15, 30, 45, 60].map(v => (
        <g key={v}>
          <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PL - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}
      {CATEGORIES.map(c => {
        const pts = history.map((h, i) => [px(i), py(h.scores[c.id] || 0)]);
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
          const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
          d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
        }
        return (
          <g key={c.id}>
            <path d={d} fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" />
            {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke={c.color} strokeWidth="2" />)}
          </g>
        );
      })}
      {history.map((h, i) => {
        const dl = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        return <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{dl}</text>;
      })}
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

function scoreLevel(s) {
  if (s >= 50) return { label: 'Exceptional', color: '#7c3aed' };
  if (s >= 40) return { label: 'Proficient',  color: '#0d9488' };
  if (s >= 30) return { label: 'Developing',  color: '#f59e0b' };
  return              { label: 'Emerging',    color: '#ef4444' };
}

// ── Main component ───────────────────────────────────────────────
export default function SelfAssessment() {
  const { currentUser, userProfile } = useAuth();
  const [view, setView]       = useState('intro');
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState({});
  const [openGuides, setOpenGuides] = useState({}); // { questionId: bool }
  const [saving, setSaving]   = useState(false);
  const [history, setHistory] = useState([]);
  const [latest, setLatest]   = useState(null);

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  async function load() {
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const entries = (snap.data().selfAssessments || []).slice().sort((a, b) => a.date.localeCompare(b.date));
        setHistory(entries);
        if (entries.length > 0) setLatest(entries[entries.length - 1]);
      }
    } catch (e) { console.error(e); }
  }

  function computeScores(ans) {
    return Object.fromEntries(CATEGORIES.map(c => [c.id, CAT_QUESTIONS[c.id].reduce((sum, q) => sum + (ans[q.id] || 0), 0)]));
  }
  function totalScore(scores) { return Object.values(scores).reduce((s, v) => s + v, 0); }

  async function handleSave() {
    if (Object.keys(answers).length < 30) { toast.error('Please answer all 30 questions before saving.'); return; }
    setSaving(true);
    try {
      const scores = computeScores(answers);
      const entry = { date: new Date().toISOString().split('T')[0], scores, total: totalScore(scores), answers, questions: QUESTIONS };
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      const existing = snap.exists() ? (snap.data().selfAssessments || []) : [];
      await setDoc(doc(db, 'users', currentUser.uid), { selfAssessments: [...existing, entry] }, { merge: true });
      setHistory([...existing, entry]);
      setLatest(entry);
      toast.success('Assessment saved!');
      setView('results');
    } catch (e) { toast.error('Could not save. Try again.'); }
    setSaving(false);
  }

  function startNew() { setAnswers({}); setOpenGuides({}); setStep(0); setView('form'); }
  function toggleGuide(id) { setOpenGuides(g => ({ ...g, [id]: !g[id] })); }

  const currentCat   = CATEGORIES[step];
  const catQuestions = currentCat ? CAT_QUESTIONS[currentCat.id] : [];
  const catAnswered  = catQuestions.filter(q => answers[q.id]).length;
  const totalAnswered = Object.keys(answers).length;
  const allAnswered  = totalAnswered === 30;

  // ── INTRO ──
  if (view === 'intro') {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }} className="space-y-6">
        <PageHeader icon="📋" title="Accountability Self-Assessment" subtitle="30 behavior statements · 5 leadership practices · Scored 1–10" />
        {latest && (
          <div style={{ borderRadius: 14, border: '1px solid #99f6e4', background: '#f0fdfa', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontWeight: 700, color: '#0f766e', margin: 0, fontSize: '0.875rem' }}>Last assessment: {new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              <p style={{ color: '#0d9488', margin: 0, fontSize: '0.78rem' }}>Total score: <strong>{latest.total}/300</strong> · {history.length} assessment{history.length !== 1 ? 's' : ''} completed</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('results')} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>View Results</button>
              <button onClick={() => setView('history')} style={{ background: 'white', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>View Progress</button>
            </div>
          </div>
        )}
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
          <h2 style={{ fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '1.25rem' }}>Accountability Practice Inventory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Rate yourself honestly on 30 accountability behavior statements across the 5 core practices. Each question includes a <strong>Scoring Guide</strong> with concrete examples to help you calibrate your answer accurately — based on real actions, not intentions.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20, textAlign: 'left' }}>
            {CATEGORIES.map(c => (
              <div key={c.id} style={{ borderRadius: 10, border: `1px solid ${c.border}`, background: c.light, padding: '0.75rem' }}>
                <p style={{ fontSize: '1.125rem', margin: '0 0 4px' }}>{c.icon}</p>
                <p style={{ fontWeight: 800, color: c.color, margin: '0 0 2px', fontSize: '0.75rem' }}>{c.label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', margin: 0, lineHeight: 1.4 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Score scale out of 300 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.8rem', textAlign: 'center' }}>Accountability Leader Score Scale · out of 300 points</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { key: 'emerging',   label: 'Emerging',   range: '0 – 120',   sub: 'Avg 1–4 per question',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
                { key: 'developing', label: 'Developing', range: '121 – 180', sub: 'Avg 5–6 per question',   color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
                { key: 'strong',     label: 'Strong',     range: '181 – 270', sub: 'Avg 7–9 per question',   color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
                { key: 'exemplary',  label: 'Exemplary',  range: '271 – 300', sub: 'Avg 10 per question',    color: '#7c3aed', bg: '#fdf4ff', border: '#e9d5ff' },
              ].map(lvl => (
                <div key={lvl.key} style={{ borderRadius: 10, border: `1px solid ${lvl.border}`, background: lvl.bg, padding: '0.625rem 0.75rem' }}>
                  <p style={{ fontWeight: 800, color: lvl.color, margin: '0 0 2px', fontSize: '0.75rem' }}>{lvl.label}</p>
                  <p style={{ fontWeight: 900, color: lvl.color, margin: '0 0 3px', fontSize: '1rem', lineHeight: 1 }}>{lvl.range}</p>
                  <p style={{ color: lvl.color, margin: 0, fontSize: '0.62rem', opacity: 0.75 }}>{lvl.sub}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>⏱ ~10–15 minutes</div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>30 questions · 1–10 scale</div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>📖 Scoring guide per question</div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.625rem 1rem', fontSize: '0.78rem', color: '#64748b' }}>🔁 Retake every 3 months</div>
          </div>
          <button onClick={startNew} style={{ background: 'linear-gradient(135deg,#0f2044,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '0.75rem 2rem', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
            {latest ? 'Retake Assessment' : 'Start Assessment'} →
          </button>
        </div>
      </div>
    );
  }

  // ── FORM ──
  if (view === 'form') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }} className="space-y-5">
        {/* Progress bar */}
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-bg)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>Question {totalAnswered} of 30</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{Math.round((totalAnswered / 30) * 100)}% complete</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 8 }}>
            <div style={{ height: 8, borderRadius: 9999, background: 'linear-gradient(90deg,#0f2044,#0d9488)', width: `${(totalAnswered / 30) * 100}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {CATEGORIES.map((c, i) => (
              <button key={c.id} onClick={() => setStep(i)} title={c.label} style={{ flex: 1, height: 5, borderRadius: 9999, border: 'none', cursor: 'pointer', background: i < step ? c.color : i === step ? c.color : '#e2e8f0', opacity: i < step ? 0.5 : 1 }} />
            ))}
          </div>
        </div>

        {/* Category header */}
        <div style={{ borderRadius: 14, background: currentCat.bg, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '2rem' }}>{currentCat.icon}</span>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Practice {step + 1} of 5</p>
            <p style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', margin: '2px 0' }}>{currentCat.label}</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', margin: 0 }}>{catAnswered}/6 answered · {currentCat.desc}</p>
          </div>
        </div>

        {/* Tip about guide */}
        <div style={{ borderRadius: 10, background: '#fffbeb', border: '1px solid #fcd34d', padding: '0.625rem 0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem' }}>💡</span>
          <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
            <strong>Tip:</strong> Click <strong>"View Scoring Guide"</strong> on any question to see concrete behavior examples for each score range. Rate based on your <em>actual recent actions</em>, not your intentions.
          </p>
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {catQuestions.map(q => {
            const val = answers[q.id];
            const guideOpen = openGuides[q.id];
            return (
              <div key={q.id} className="card" style={{ padding: '1.125rem 1.25rem', border: val ? `1.5px solid ${currentCat.border}` : '1px solid var(--border)' }}>
                {/* Question header */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ background: val ? currentCat.bg : '#f1f5f9', color: val ? 'white' : '#64748b', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                    {q.id}
                  </span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, fontWeight: val ? 600 : 400, flex: 1 }}>{q.text}</p>
                </div>

                {/* 1-10 rating buttons */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const active = val === n;
                    const btnColor = n >= 7 ? currentCat.color : n >= 5 ? '#f59e0b' : '#ef4444';
                    return (
                      <button key={n} onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))} style={{
                        width: 38, height: 34, borderRadius: 8,
                        border: active ? `2px solid ${btnColor}` : '1px solid #e2e8f0',
                        background: active ? btnColor : '#f8fafc',
                        color: active ? 'white' : '#64748b',
                        fontWeight: active ? 800 : 600, fontSize: '0.8125rem',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>{n}</button>
                    );
                  })}
                  {val && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, alignSelf: 'center', marginLeft: 4,
                      color: val >= 7 ? currentCat.color : val >= 5 ? '#f59e0b' : '#ef4444',
                    }}>
                      {val <= 4 ? 'Emerging' : val <= 6 ? 'Developing' : val <= 9 ? 'Strong' : 'Exemplary'}
                    </span>
                  )}
                  {!val && <span style={{ fontSize: '0.68rem', color: '#94a3b8', alignSelf: 'center', marginLeft: 4 }}>1 = Rarely · 10 = Almost Always</span>}
                </div>

                {/* Scoring guide toggle */}
                <button
                  onClick={() => toggleGuide(q.id)}
                  style={{
                    background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{guideOpen ? '▲' : '▼'}</span>
                  {guideOpen ? 'Hide' : 'View'} Scoring Guide
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {q.tools}</span>
                </button>

                {guideOpen && <ScoringGuide question={q} catColor={currentCat.color} />}
              </div>
            );
          })}
        </div>

        {/* Unanswered questions warning on last step */}
        {step === 4 && !allAnswered && (() => {
          const unanswered = QUESTIONS.filter(q => !answers[q.id]);
          const byStep = CATEGORIES.map((cat, idx) => ({
            idx, cat, missing: unanswered.filter(q => q.cat === cat.id),
          })).filter(g => g.missing.length > 0);
          return (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 4 }}>
              <p style={{ fontWeight: 700, color: '#92400e', fontSize: '0.8rem', margin: '0 0 6px' }}>⚠️ {unanswered.length} question{unanswered.length > 1 ? 's' : ''} still need{unanswered.length === 1 ? 's' : ''} an answer:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {byStep.map(({ idx, cat, missing }) => (
                  <button key={cat.id} onClick={() => setStep(idx)}
                    style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 99, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', cursor: 'pointer' }}>
                    {cat.icon} {cat.label}: Q{missing.map(q => q.id).join(', Q')}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem' }}>
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setView('intro')}
            style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, padding: '0.625rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            ← {step === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              style={{ background: currentCat.color, color: 'white', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              Next Practice →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || !allAnswered}
              style={{ background: allAnswered ? 'linear-gradient(135deg,#0f2044,#0d9488)' : '#e2e8f0', color: allAnswered ? 'white' : '#94a3b8', border: 'none', borderRadius: 10, padding: '0.625rem 1.5rem', fontWeight: 800, fontSize: '0.875rem', cursor: allAnswered ? 'pointer' : 'not-allowed' }}>
              {saving ? '⏳ Saving...' : `💾 Save Results (${totalAnswered}/30)`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  if (view === 'results' && latest) {
    const scores = latest.scores;
    const total  = latest.total;
    const date   = new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const overall = scoreLevel(total / 5);
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }} className="space-y-5">
        <PageHeader icon="📊" title="Assessment Results" subtitle={`Completed ${date} · ${history.length} assessment${history.length !== 1 ? 's' : ''} total`}
          action={<div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('history')} style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>📈 Progress</button>
            <button onClick={() => generateAssessmentReport(latest, userProfile?.displayName || '', userProfile?.role || '', QUESTIONS)}
              style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>📄 Download PDF</button>
            <button onClick={startNew} style={{ background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Retake</button>
          </div>}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Total score hero */}
            <div style={{ borderRadius: 14, background: 'linear-gradient(135deg,#0f2044,#1e3a6e,#0d9488)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Total Score</p>
                <p style={{ color: 'white', fontSize: '3.5rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{total}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', margin: '4px 0 0' }}>out of 300</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', margin: '0 0 4px' }}>Overall level</p>
                <p style={{ color: overall.color, fontWeight: 900, fontSize: '1.5rem', margin: '0 0 8px' }}>{overall.label}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
                  Each practice is scored out of 60 (6 questions × 10). Retake every 3 months to track your leadership growth.
                </p>
              </div>
            </div>
            {/* Per-category bars */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px', fontSize: '0.95rem' }}>Score by Leadership Practice</p>
              {CATEGORIES.map(c => {
                const s = scores[c.id] || 0;
                const pct = Math.round((s / 60) * 100);
                const lvl = scoreLevel(s);
                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1rem' }}>{c.icon}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{c.label}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: lvl.color, background: `${lvl.color}18`, borderRadius: 99, padding: '1px 7px' }}>{lvl.label}</span>
                      </div>
                      <span style={{ fontWeight: 900, color: c.color, fontSize: '0.95rem' }}>{s}<span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.75rem' }}>/60</span></span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 9 }}>
                      <div style={{ height: 9, borderRadius: 9999, background: c.bg, width: `${pct}%`, transition: 'width 1.2s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Top 5 Strengths & Opportunities */}
            {(() => {
              const scored = QUESTIONS.map(q => ({ ...q, score: latest.answers?.[q.id] || 0, cat: CATEGORIES.find(c => c.id === q.cat) }))
                .sort((a, b) => b.score - a.score);
              const top5 = scored.slice(0, 5);
              const bottom5 = [...scored].sort((a, b) => a.score - b.score).slice(0, 5);
              const renderRow = (q, rank, accent) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: accent.bg, color: accent.text, fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rank}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.35 }}>{q.text}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: q.cat?.color || '#94a3b8', fontWeight: 700 }}>{q.cat?.icon} {q.cat?.label}</p>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: accent.text, flexShrink: 0 }}>{q.score}<span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400 }}>/10</span></div>
                </div>
              );
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <p style={{ fontWeight: 800, color: '#15803d', margin: '0 0 12px', fontSize: '0.9rem' }}>💪 Top 5 Strengths</p>
                    {top5.map((q, i) => renderRow(q, i + 1, { bg: '#dcfce7', text: '#15803d' }))}
                  </div>
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <p style={{ fontWeight: 800, color: '#c2410c', margin: '0 0 12px', fontSize: '0.9rem' }}>🎯 Top 5 Opportunities</p>
                    {bottom5.map((q, i) => renderRow(q, i + 1, { bg: '#fee2e2', text: '#dc2626' }))}
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Radar chart */}
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.9rem' }}>Practice Profile</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>Score per leadership practice</p>
            <RadarChart scores={scores} size={240} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, textAlign: 'left' }}>
              {CATEGORIES.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flex: 1 }}>{c.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: c.color }}>{scores[c.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── HISTORY ──
  if (view === 'history') {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-5">
        <PageHeader icon="📈" title="Assessment Progress" subtitle="Track your leadership growth over time — retake every 3 months."
          action={<div style={{ display: 'flex', gap: 8 }}>
            {latest && <button onClick={() => setView('results')} style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>📊 Results</button>}
            <button onClick={startNew} style={{ background: '#0f2044', color: 'white', border: 'none', borderRadius: 8, padding: '0.4rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>+ New Assessment</button>
          </div>}
        />
        {/* Total trend */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.95rem' }}>Overall Score Trend</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>Total accountability score (max 300)</p>
          {history.length < 2 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>Complete at least 2 assessments to see your trend.</p>
          ) : (() => {
            const W=520,H=160,PL=40,PR=16,PT=12,PB=36,cW=W-PL-PR,cH=H-PT-PB;
            const px=i=>PL+(i/(history.length-1))*cW, py=v=>PT+cH-(v/300)*cH;
            const pts=history.map((h,i)=>[px(i),py(h.total)]);
            let d=`M ${pts[0][0]} ${pts[0][1]}`;
            for(let i=1;i<pts.length;i++){const cpx=(pts[i-1][0]+pts[i][0])/2;d+=` C ${cpx} ${pts[i-1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;}
            const fillD=d+` L ${pts[pts.length-1][0]} ${PT+cH} L ${pts[0][0]} ${PT+cH} Z`;
            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
                <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity="0.2"/><stop offset="100%" stopColor="#0d9488" stopOpacity="0"/></linearGradient></defs>
                {[0,75,150,225,300].map(v=>(<g key={v}><line x1={PL} y1={py(v)} x2={W-PR} y2={py(v)} stroke="#f1f5f9" strokeWidth="1"/><text x={PL-4} y={py(v)+4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text></g>))}
                <path d={fillD} fill="url(#tg)"/>
                <path d={d} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round"/>
                {pts.map(([x,y],i)=>(<g key={i}><circle cx={x} cy={y} r="5" fill="white" stroke="#0d9488" strokeWidth="2.5"/><text x={x} y={y-9} textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f766e">{history[i].total}</text></g>))}
                {history.map((h,i)=>{const dl=new Date(h.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});return <text key={i} x={px(i)} y={H-4} textAnchor="middle" fontSize="9" fill="#94a3b8">{dl}</text>;})}
                <line x1={PL} y1={PT+cH} x2={W-PR} y2={PT+cH} stroke="#e2e8f0" strokeWidth="1"/>
              </svg>
            );
          })()}
        </div>
        {/* Per-practice trend */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.95rem' }}>Progress by Leadership Practice</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>Score per practice (max 60 each)</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {CATEGORIES.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 3, borderRadius: 9999, background: c.color }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.icon} {c.label}</span>
              </div>
            ))}
          </div>
          <HistoryChart history={history} />
        </div>
        {/* History list */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', fontSize: '0.95rem' }}>Assessment History</p>
          {history.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>No assessments yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...history].reverse().map((h, idx) => {
                const d = new Date(h.date+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
                const lvl = scoreLevel(h.total / 5);
                return (
                  <div key={idx} style={{ borderRadius: 10, border: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.875rem' }}>{d}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {CATEGORIES.map(c => <span key={c.id} style={{ fontSize: '0.68rem', color: c.color, fontWeight: 700 }}>{c.icon} {h.scores[c.id]}</span>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: lvl.color, background: `${lvl.color}18`, borderRadius: 99, padding: '2px 9px' }}>{lvl.label}</span>
                      <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1rem' }}>{h.total}<span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.72rem' }}>/300</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
