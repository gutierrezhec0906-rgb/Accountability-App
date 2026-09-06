// 100 Accountability Phrases — one shown per day, cycling back to #1 after
// #100. Grouped under the same 5 leadership categories used by the sidebar
// nav (client/src/components/Layout.jsx `navCategories`), so each day's
// phrase can borrow that category's icon/color for a consistent look.
//
// Day selection is deterministic (days elapsed since PHRASE_EPOCH, mod 100)
// so every user on every device sees the same phrase on the same calendar
// day — see pickTodaysPhrase() below.

export const PHRASE_CATEGORIES = {
  model:     { label: 'Set the Bar',            icon: '🧭', color: '#2563eb' },
  inspire:   { label: 'Spark the Vision',        icon: '🔭', color: '#0d9488' },
  challenge: { label: 'Improve the Flow',        icon: '⚙️', color: '#d97706' },
  enable:    { label: 'Enable the Team',         icon: '🤝', color: '#7c3aed' },
  encourage: { label: 'Winning with Compassion', icon: '❤️', color: '#e11d48' },
};

export const DAILY_PHRASES = [
  // 1. Set the Bar — standards, accountability, raising expectations
  { text: "Let's raise the bar.", cat: 'model', tip: 'Use when the team is settling for "good enough" — it resets the standard without attacking anyone\'s past effort.' },
  { text: 'I want us punching above our weight.', cat: 'model', tip: 'Use to challenge a team that is underselling its own capability relative to bigger or more resourced competitors.' },
  { text: "What's our fallback if this doesn't land?", cat: 'model', tip: 'Ask before committing to a risky plan — it forces a contingency conversation instead of blind optimism.' },
  { text: 'What gets measured gets managed.', cat: 'model', tip: "Say this when a goal has no metric attached yet — it's a prompt to define how success will be tracked." },
  { text: "Let's not let perfect be the enemy of good.", cat: 'model', tip: 'Use when analysis-paralysis or endless polishing is delaying a decision that would be fine to ship now.' },
  { text: "I'd rather be directionally right than perfectly wrong.", cat: 'model', tip: 'Use when a team is stuck seeking certainty — it gives permission to move on a reasonable estimate.' },
  { text: 'Done is better than perfect.', cat: 'model', tip: 'A short nudge for a perfectionist teammate who is over-refining something with diminishing returns.' },
  { text: "Let's tighten the feedback loop.", cat: 'model', tip: 'Use when results take too long to reach the people who need to act on them — shorten the cycle.' },
  { text: "What's the ROI on this?", cat: 'model', tip: 'Ask before greenlighting new work — it forces a value justification instead of activity for its own sake.' },
  { text: "Let's stress-test that assumption.", cat: 'model', tip: 'Use when a plan rests on something nobody has actually verified — pressure-test it before committing resources.' },
  { text: 'I want to see the data behind that.', cat: 'model', tip: 'Use when a claim or recommendation is being made on gut feel alone — ask for the evidence.' },
  { text: "Let's separate signal from noise.", cat: 'model', tip: 'Use in a data-heavy discussion to refocus on the few metrics that actually indicate what matters.' },
  { text: "Numbers don't lie.", cat: 'model', tip: 'Use when a narrative is drifting from what the actual results show — bring the conversation back to facts.' },
  { text: "Let's double down on what's working.", cat: 'model', tip: 'Use in a review meeting to redirect energy toward proven wins instead of chasing every new idea.' },
  { text: 'We need to move the needle.', cat: 'model', tip: 'Use when effort is being spent on things that look busy but aren\'t changing the outcome that matters.' },
  { text: "That's a lagging indicator — what's leading?", cat: 'model', tip: 'Use when a team only tracks results after the fact — ask for an earlier warning signal instead.' },
  { text: "Let's not overreact to a single data point.", cat: 'model', tip: 'Use when one bad (or good) number is about to trigger a disproportionate response — ask for the trend.' },
  { text: 'This is a solvable problem.', cat: 'model', tip: "Use to reframe a discouraged team's mindset from \"this is broken\" to \"this has a path forward.\"" },
  { text: "Let's not boil the ocean.", cat: 'model', tip: 'Use when scope is creeping — redirect the group to the smallest version that actually solves the problem.' },
  { text: 'Is this a priority or just urgent?', cat: 'model', tip: 'Use when a loud, time-sensitive ask is crowding out more important work — separate urgency from importance.' },

  // 2. Spark the Vision — purpose, direction, long-term thinking
  { text: "Let's zoom out for a second.", cat: 'inspire', tip: 'Use when a discussion is stuck in the weeds — pull the group back to the bigger picture.' },
  { text: "What's the north star here?", cat: 'inspire', tip: 'Use when a team has multiple competing priorities and needs one shared reference point to align around.' },
  { text: 'We need to think three moves ahead.', cat: 'inspire', tip: "Use when a decision is being made in isolation — ask what it sets up (or blocks) down the road." },
  { text: "Let's future-proof this decision.", cat: 'inspire', tip: 'Use before locking in a choice that would be expensive to reverse — check it against likely future needs.' },
  { text: "What's the second-order effect?", cat: 'inspire', tip: 'Use when a plan\'s immediate benefit is obvious but its downstream consequences haven\'t been discussed yet.' },
  { text: "We're playing the long game.", cat: 'inspire', tip: 'Use to justify a short-term sacrifice (cost, speed, comfort) in service of a bigger future payoff.' },
  { text: 'This needs to scale, not just work.', cat: 'inspire', tip: 'Use when a fragile, one-off solution is being proposed for something that will recur or grow.' },
  { text: "Let's turn this into an opportunity.", cat: 'inspire', tip: 'Use right after a setback, to redirect the team\'s energy from blame toward what can now be built.' },
  { text: "We're not here to play it safe.", cat: 'inspire', tip: 'Use when caution is quietly capping ambition — give the team permission to propose the bolder option.' },
  { text: 'This is a marathon, not a sprint.', cat: 'inspire', tip: 'Use when the team is burning out chasing short-term wins — reset the pace for sustainability.' },
  { text: 'I believe in the mission.', cat: 'inspire', tip: 'Use in a moment of doubt to reconnect the team\'s daily work to the larger purpose behind it.' },
  { text: "We're building something that matters.", cat: 'inspire', tip: 'Use when routine work feels disconnected from meaning — remind the team what it adds up to.' },
  { text: 'This is bigger than any one of us.', cat: 'inspire', tip: 'Use to defuse a turf or ego conflict by refocusing everyone on the shared outcome.' },
  { text: "Let's disrupt ourselves before someone else does.", cat: 'inspire', tip: 'Use when comfort with the current model is blinding the team to a coming competitive threat.' },
  { text: "We're building the plane while flying it.", cat: 'inspire', tip: 'Use to acknowledge imperfect, in-motion execution honestly instead of pretending everything is fully planned.' },
  { text: "Growth isn't linear.", cat: 'inspire', tip: 'Use when progress stalls or dips — remind the team that plateaus are a normal part of real growth.' },
  { text: "Let's challenge our own assumptions.", cat: 'inspire', tip: 'Use before a big decision to make sure the team isn\'t just repeating "the way we\'ve always done it."' },
  { text: "We're in build mode.", cat: 'inspire', tip: 'Use to set expectations that the current phase is about creating and iterating, not optimizing yet.' },
  { text: "Let's not be precious about how we got here.", cat: 'inspire', tip: 'Use when sunk cost or nostalgia is blocking a needed change of direction.' },
  { text: 'Onward.', cat: 'inspire', tip: 'Use as a short close to a hard conversation or a tough week — acknowledge it, then move forward together.' },

  // 3. Improve the Flow — process, efficiency, continuous improvement
  { text: "Let's focus on outcomes, not activity.", cat: 'challenge', tip: 'Use when a status update is full of "busy" but light on actual results — redirect to what changed.' },
  { text: "What's blocking us?", cat: 'challenge', tip: 'Use in a stalled project to surface the real obstacle instead of letting it go unnamed.' },
  { text: "Let's not let this fall through the cracks.", cat: 'challenge', tip: 'Use when an item has no clear owner or next step — flag it before it gets lost.' },
  { text: "What's the plan to get back on track?", cat: 'challenge', tip: 'Use when a project has slipped — shift the conversation from "why" it slipped to "how" it recovers.' },
  { text: "Let's close the loop on that.", cat: 'challenge', tip: 'Use when an open item from a past conversation hasn\'t been resolved or communicated back yet.' },
  { text: "Let's take that offline.", cat: 'challenge', tip: 'Use in a meeting when a side topic is derailing the agenda — park it for a smaller follow-up.' },
  { text: 'Can we align on next steps?', cat: 'challenge', tip: 'Use to close out a discussion that has generated good ideas but no concrete actions yet.' },
  { text: "Let's put a pin in that.", cat: 'challenge', tip: 'Use to acknowledge a valid point without derailing the current agenda — commit to revisiting it later.' },
  { text: "Let's table that for now.", cat: 'challenge', tip: 'Use when a topic needs more information or the right people before it can be usefully decided.' },
  { text: 'Bottom line up front, please.', cat: 'challenge', tip: 'Use when an update is taking too long to get to the point — ask for the conclusion first.' },
  { text: "Let's not boil this down to a meeting about a meeting.", cat: 'challenge', tip: 'Use when scheduling overhead is replacing actual decision-making — push for a direct resolution instead.' },
  { text: "I'll circle back on that.", cat: 'challenge', tip: 'Use when you need time to get the right answer — commits you to following up instead of dropping it.' },
  { text: "Let's make sure we're not talking past each other.", cat: 'challenge', tip: 'Use when a discussion is going in circles — pause to check both sides are using the same terms.' },
  { text: "What's the cost of inaction?", cat: 'challenge', tip: 'Use when a team is stalling on a decision — make the risk of doing nothing explicit.' },
  { text: "Let's de-risk this before we commit.", cat: 'challenge', tip: 'Use before a big bet — identify the biggest unknowns and test them cheaply first.' },
  { text: "Let's control what we can control.", cat: 'challenge', tip: 'Use when a team is stuck worrying about factors outside its influence — refocus on actionable levers.' },
  { text: "Let's not let this become a fire drill.", cat: 'challenge', tip: 'Use early on a growing issue, before panic sets in, to keep the response calm and planned.' },
  { text: "What's our exposure here?", cat: 'challenge', tip: 'Use when assessing a risk — ask plainly how much the team stands to lose if it goes wrong.' },
  { text: 'I want a plan B on the table.', cat: 'challenge', tip: 'Use when a plan only has one path to success — require a backup before committing.' },
  { text: "Let's get ahead of this.", cat: 'challenge', tip: 'Use when a small issue is visible now but could grow — act proactively instead of waiting for it to escalate.' },

  // 4. Enable the Team — empowerment, ownership, delegation
  { text: 'Who owns this?', cat: 'enable', tip: 'Use whenever a task or decision has no clear name attached to it — assign ownership immediately.' },
  { text: 'I need eyes on this by EOD.', cat: 'enable', tip: 'Use to set a clear, time-boxed expectation instead of an open-ended "whenever you get a chance."' },
  { text: 'I own that decision.', cat: 'enable', tip: 'Use to take visible responsibility for a call you made, especially if it didn\'t go as planned.' },
  { text: 'I hold myself accountable for that miss.', cat: 'enable', tip: 'Use after a mistake to model ownership rather than deflecting — it sets the tone for the team.' },
  { text: 'No surprises — flag it early.', cat: 'enable', tip: 'Use to establish a norm that problems should be raised the moment they\'re spotted, not hidden until deadline.' },
  { text: "What did we learn from this?", cat: 'enable', tip: 'Use after any project — win or loss — to turn the experience into a lesson instead of just closing it out.' },
  { text: "Let's empower people to make the call.", cat: 'enable', tip: 'Use when decisions are bottlenecking at the top — push authority down to whoever is closest to the work.' },
  { text: 'I trust the team to figure this out.', cat: 'enable', tip: 'Use when you\'re tempted to micromanage a solvable problem — give the team room to own it.' },
  { text: 'I want to hear the dissenting view.', cat: 'enable', tip: 'Use before finalizing a decision, to actively invite disagreement instead of assuming silence means consensus.' },
  { text: "Let's create space for that conversation.", cat: 'enable', tip: 'Use when a real issue is being glossed over — explicitly make room to address it properly.' },
  { text: "That's a growth opportunity for you.", cat: 'enable', tip: 'Use when handing someone a stretch assignment — frame it as development, not just extra work.' },
  { text: 'I believe in this team.', cat: 'enable', tip: 'Use before a hard challenge to give the team confidence and a vote of trust up front.' },
  { text: 'We win and lose together.', cat: 'enable', tip: 'Use after a shared setback to prevent individual blame-shifting and keep the team unified.' },
  { text: "Let's not let a good conversation go to waste.", cat: 'enable', tip: 'Use at the end of a rich discussion to make sure it converts into a decision or action.' },
  { text: 'I want owners and dates before we leave this room.', cat: 'enable', tip: 'Use to close a meeting — force concrete commitments instead of vague follow-up intentions.' },
  { text: "Let's summarize where we landed.", cat: 'enable', tip: 'Use at the end of a meeting to confirm everyone shares the same understanding of the outcome.' },
  { text: "Great discussion — let's turn this into action.", cat: 'enable', tip: 'Use to bridge from a productive conversation to a concrete next step before energy fades.' },
  { text: "Let's make sure this doesn't just live in a deck.", cat: 'enable', tip: 'Use when a plan risks becoming a document nobody actually executes — push for real follow-through.' },
  { text: 'I want conviction, not consensus.', cat: 'enable', tip: 'Use when a group is watering down a decision just to make everyone comfortable — ask for a real stance.' },
  { text: "Let's make the call and move.", cat: 'enable', tip: 'Use when a decision has been debated enough — decide with the information available and proceed.' },

  // 5. Winning with Compassion — culture, empathy, human connection
  { text: "Great point — let's build on that.", cat: 'encourage', tip: 'Use to validate a contribution and keep the momentum of a good idea going in the room.' },
  { text: "I appreciate the pushback — that's how good decisions get made.", cat: 'encourage', tip: 'Use when someone challenges you directly — reward the honesty instead of getting defensive.' },
  { text: "Thanks for the candor — that's how we get better.", cat: 'encourage', tip: 'Use after receiving tough feedback, to reinforce that honesty is welcome, not punished.' },
  { text: "Let's stay heads-down and deliver.", cat: 'encourage', tip: 'Use when distractions or noise are pulling focus — refocus the team on execution.' },
  { text: 'Every setback is a setup for a comeback.', cat: 'encourage', tip: 'Use after a loss to reframe it as the starting point for the next win, not a dead end.' },
  { text: "Let's earn the right to win.", cat: 'encourage', tip: 'Use to emphasize that results come from consistent effort, not shortcuts or entitlement.' },
  { text: "Let's finish strong.", cat: 'encourage', tip: 'Use near the end of a project or quarter to rally energy for a strong close instead of coasting.' },
  { text: "Let's go build.", cat: 'encourage', tip: 'Use as an energizing close to a planning session — signal it\'s time to move from talk to action.' },
  { text: "Let's not panic — let's assess.", cat: 'encourage', tip: 'Use in a crisis moment to slow reactions down and get an accurate read before responding.' },
  { text: 'I want a clear-eyed view of the risk.', cat: 'encourage', tip: 'Use when optimism (or fear) is distorting how a situation is being described — ask for the unvarnished truth.' },
  { text: 'Complacency is the real competitor.', cat: 'encourage', tip: "Use when a team is coasting on past success — the real threat is comfort, not the market." },
  { text: "Let's not let complacency win.", cat: 'encourage', tip: 'Use as a reminder mid-streak of good results, to keep the standard from quietly slipping.' },
  { text: 'We need to be comfortable with discomfort.', cat: 'encourage', tip: 'Use when a necessary change is being resisted because it feels awkward or hard, not because it\'s wrong.' },
  { text: "We need to unlearn some old habits.", cat: 'encourage', tip: 'Use when past success is making the team resistant to a needed new approach.' },
  { text: "Let's level-set with everyone.", cat: 'encourage', tip: 'Use when different people have different information — bring the whole group to the same baseline.' },
  { text: 'Can we get on the same page?', cat: 'encourage', tip: 'Use when misalignment is causing friction — a simple, non-confrontational way to ask for clarity.' },
  { text: 'I want to hear the dissenting view.', cat: 'encourage', tip: 'Use here for empathy-led listening — ask so the disagreeing voice feels genuinely heard, not just tolerated.' },
  { text: "Let's not let this become personal — let's make it productive.", cat: 'encourage', tip: 'Use when a conflict is drifting from the issue to the people — redirect it back to the problem.' },
  { text: "Great teams don't get comfortable. They get better.", cat: 'encourage', tip: 'Use to challenge a high-performing team not to plateau — keep raising their own bar.' },
  { text: 'Not because you want more — because you trust them.', cat: 'encourage', tip: 'Use when delegating, to frame it as an expression of trust rather than offloading work.' },
];

// Fixed reference point — NOT when the feature shipped, just an arbitrary
// anchor so the day math is stable forever. Do not change this once live,
// or every user's "today's phrase" will jump.
const PHRASE_EPOCH = new Date(2026, 0, 1); // Jan 1, 2026, local time

// Which of the 100 phrases to show today — same for every user/device on
// the same calendar day, cycling back to index 0 after 100 days.
export function pickTodaysPhrase(date = new Date()) {
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceEpoch = Math.floor((d1 - PHRASE_EPOCH) / 86400000);
  const idx = ((daysSinceEpoch % DAILY_PHRASES.length) + DAILY_PHRASES.length) % DAILY_PHRASES.length;
  return { ...DAILY_PHRASES[idx], day: idx + 1 };
}

// "YYYY-MM-DD" for the seen-today localStorage gate — local calendar date.
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
