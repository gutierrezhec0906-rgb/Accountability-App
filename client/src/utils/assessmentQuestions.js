export const CATEGORIES = [
  { id: 'model',     label: 'Model the Way',            icon: '🧭', color: '#2563eb', bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)', light: '#eff6ff', border: '#bfdbfe', desc: 'Setting personal example and upholding shared values.' },
  { id: 'inspire',   label: 'Inspire a Shared Vision',  icon: '🔭', color: '#0d9488', bg: 'linear-gradient(135deg,#134e4a,#0d9488)', light: '#f0fdfa', border: '#99f6e4', desc: 'Painting the future and enlisting others in the dream.' },
  { id: 'challenge', label: 'Challenge the Process',    icon: '⚙️', color: '#d97706', bg: 'linear-gradient(135deg,#78350f,#d97706)', light: '#fffbeb', border: '#fcd34d', desc: 'Seeking innovation and learning from setbacks.' },
  { id: 'enable',    label: 'Enable Others to Act',     icon: '🤝', color: '#7c3aed', bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)', light: '#fdf4ff', border: '#e9d5ff', desc: 'Fostering collaboration and building capability.' },
  { id: 'encourage', label: 'Encourage the Heart',      icon: '❤️', color: '#e11d48', bg: 'linear-gradient(135deg,#881337,#e11d48)', light: '#fff1f2', border: '#fecdd3', desc: 'Recognizing contributions and celebrating victories.' },
];

export const GUIDE_LEVELS = [
  { key: 'emerging',   label: '1–4  Emerging',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { key: 'developing', label: '5–6  Developing',  color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
  { key: 'strong',     label: '7–9  Strong',      color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'exemplary',  label: '10   Exemplary',   color: '#7c3aed', bg: '#fdf4ff', border: '#e9d5ff' },
];

export const QUESTIONS = [
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

export const CAT_QUESTIONS = Object.fromEntries(
  ['model','inspire','challenge','enable','encourage'].map(id => [id, QUESTIONS.filter(q => q.cat === id)])
);
