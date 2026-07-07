import { jsPDF } from 'jspdf';

// ─── Recommendation content keyed by dimension + score band ────────────────

const RECS = {
  'self-awareness': {
    label: 'Self-Awareness',
    icon: '🪞',
    low: {
      strength: null,
      weakness: 'Limited visibility into your own emotional states, triggers, and impact on others.',
      actions: [
        'Start a daily 5-minute emotion journal — write what you felt, what triggered it, and what you did.',
        'After difficult interactions, ask yourself: "What emotion was driving me right then?"',
        'Request candid feedback from a trusted peer: "What do you notice I do when I\'m under pressure?"',
        'Take a validated EQ self-assessment every 60 days and compare results to track shifts.',
        'Identify your top 3 personal triggers and share them proactively with your team.',
      ],
    },
    mid: {
      strength: 'You recognize your emotions in familiar situations.',
      weakness: 'Blind spots emerge under pressure or in unfamiliar settings.',
      actions: [
        'Practice "pause and name" — in tense moments, silently label the emotion before responding.',
        'Ask for quarterly 360 feedback specifically on your emotional impact during high-stakes moments.',
        'Study your patterns: note when blind spots tend to appear (conflict, ambiguity, evaluation).',
        'Debrief after important meetings: "What did I feel? Did it help or hinder the outcome?"',
        'Work with a coach or mentor to surface patterns you cannot see yourself.',
      ],
    },
    high: {
      strength: 'Strong self-knowledge across varied situations, including difficult ones.',
      weakness: 'Minor blind spots under extreme stress or with certain relationships.',
      actions: [
        'Deepen impact by helping a team member grow their self-awareness through structured reflection.',
        'Document your emotional playbook — what you do, feel, and decide when under peak pressure.',
        'Seek feedback after your most challenging moments to calibrate your self-perception.',
        'Share your self-awareness practices in team forums to normalize emotional literacy.',
        'Experiment with different stress-management techniques to close any remaining reactive gaps.',
      ],
    },
  },

  'self-regulation': {
    label: 'Self-Regulation',
    icon: '🎛️',
    low: {
      strength: null,
      weakness: 'Emotions frequently drive reactive behavior, especially under pressure or conflict.',
      actions: [
        'Implement the "6-second rule": pause 6 seconds before responding in any tense moment.',
        'Identify your physical stress signals (chest tightening, faster speech) as your early-warning system.',
        'Practice box breathing (4 counts in, hold, out, hold) before high-stakes conversations.',
        'Reframe: when frustrated, ask "What is this situation asking of me?" instead of reacting.',
        'Create a personal "trigger plan" — document your top triggers and a prepared calm response for each.',
      ],
    },
    mid: {
      strength: 'Generally manages emotions well in routine situations.',
      weakness: 'Consistency breaks down in high-pressure or conflicted environments.',
      actions: [
        'Build a pre-conversation ritual (breath, intent-setting) before meetings you know will be tense.',
        'Debrief reactive moments within 24 hours: what triggered it, what you could do differently.',
        'Practice non-attachment: notice when you\'re overinvested in being right and consciously release it.',
        'Develop "redirect scripts" for moments when you feel yourself losing control.',
        'Enlist an accountability partner to give you a signal if your regulation slips in meetings.',
      ],
    },
    high: {
      strength: 'Reliable emotional composure, even in adversity. Others trust your steadiness.',
      weakness: 'Potential to over-suppress — ensure feelings are being processed, not just hidden.',
      actions: [
        'Share your regulation strategies visibly — it models psychological safety for your team.',
        'Check in with yourself: are you regulating or repressing? Find healthy outlets for intense emotions.',
        'Coach a colleague who struggles with regulation; teaching deepens your own mastery.',
        'Explore advanced techniques: mindfulness-based stress reduction, cognitive reframing at speed.',
        'Regularly review whether your composure is creating distance or confidence in others.',
      ],
    },
  },

  motivation: {
    label: 'Motivation',
    icon: '🔥',
    low: {
      strength: null,
      weakness: 'Internal drive is inconsistent; obstacles and setbacks significantly reduce momentum.',
      actions: [
        'Reconnect with your "why" — write a short personal mission statement tied to your role.',
        'Break large goals into weekly wins; small visible progress rebuilds intrinsic drive.',
        'Identify what energizes you vs. what drains you, and restructure your week accordingly.',
        'Find a peer or mentor who models sustained drive and have regular conversations with them.',
        'Replace "I have to" language with "I get to" and track how that reframe changes your energy.',
      ],
    },
    mid: {
      strength: 'Engages well with work that aligns to personal values.',
      weakness: 'Drive can fluctuate when work feels disconnected from purpose or recognition is low.',
      actions: [
        'Craft a "purpose bridge" — explicitly link daily tasks to a broader impact you care about.',
        'Set a bold personal stretch goal beyond your role and track it weekly.',
        'Seek feedback on which of your contributions others value most to reinforce purpose.',
        'Build habits that protect your energy: sleep, exercise, and boundaries on reactive work.',
        'Celebrate team wins intentionally — motivation is contagious when leaders model it.',
      ],
    },
    high: {
      strength: 'Consistently driven, resilient through setbacks, and inspires those around you.',
      weakness: 'Risk of burnout or dragging a less-motivated team if drive is not channeled well.',
      actions: [
        'Actively channel your drive into mentoring: pair with lower-motivation team members intentionally.',
        'Monitor your pace — ensure your high drive is sustainable and not creating pressure on others.',
        'Document your personal resilience practices and share them in team forums.',
        'Take on a new challenge or project that stretches you; high performers need new peaks.',
        'Review your team\'s motivation regularly and use your energy to elevate the collective.',
      ],
    },
  },

  empathy: {
    label: 'Empathy',
    icon: '❤️',
    low: {
      strength: null,
      weakness: 'Limited attention to others\' emotional experience makes it harder to connect, persuade, and retain trust.',
      actions: [
        'Before responding in any conversation, pause and ask: "What is this person actually feeling right now?"',
        'Practice active listening: put your phone face-down, make eye contact, and resist the urge to reply until the other person finishes.',
        'After 1:1 meetings, note one thing you learned about how the other person is feeling or experiencing their work.',
        'Read "Nonviolent Communication" by Marshall Rosenberg and apply one technique per week.',
        'In team decisions, explicitly consider the emotional impact before announcing changes.',
      ],
    },
    mid: {
      strength: 'Listens and considers others in familiar or low-stakes situations.',
      weakness: 'Empathy depth reduces when busy, in conflict, or when you disagree with someone.',
      actions: [
        'Practice "perspective-taking" before important conversations: spend 2 minutes mentally stepping into the other person\'s shoes.',
        'When you disagree, try to articulate the other person\'s position better than they can before countering.',
        'In team meetings, check the room: "Does anyone have concerns we haven\'t heard yet?"',
        'Follow up with people after difficult news or changes to see how they are genuinely doing.',
        'Learn about each team member\'s personal motivators and adjust how you interact accordingly.',
      ],
    },
    high: {
      strength: 'Deeply attuned to others\' emotions; builds trust and psychological safety naturally.',
      weakness: 'Risk of absorbing others\' stress, or over-prioritizing harmony over necessary directness.',
      actions: [
        'Set boundaries: you can empathize without taking ownership of others\' emotional states.',
        'Balance empathy with candor — practice delivering hard truths with care but without softening the message.',
        'Use your empathy gift to detect early team morale issues and address them proactively.',
        'Share your empathy practices with emerging leaders on your team.',
        'Debrief team dynamics after stressful periods to normalize emotional processing.',
      ],
    },
  },

  'social-skills': {
    label: 'Social Skills',
    icon: '🤝',
    low: {
      strength: null,
      weakness: 'Relationship-building, conflict resolution, and collaborative communication need focused development.',
      actions: [
        'Invest 15 minutes a week in non-transactional conversations — just connecting, not solving.',
        'Learn and use people\'s names consistently; it signals genuine interest.',
        'When conflict arises, lead with a question: "Help me understand your concern" before defending your position.',
        'Request feedback specifically on your communication style from three peers.',
        'Read "Crucial Conversations" and role-play one technique per week with a trusted colleague.',
      ],
    },
    mid: {
      strength: 'Builds functional relationships; communication is clear in structured settings.',
      weakness: 'Navigating ambiguous social dynamics, large groups, or conflict under pressure is inconsistent.',
      actions: [
        'Expand your network intentionally: have one new conversation per week with someone outside your immediate team.',
        'Practice conflict as a skill: seek out a low-stakes disagreement to resolve constructively.',
        'Develop your influence toolkit: storytelling, asking powerful questions, and mirroring language.',
        'Run or facilitate a team meeting you would normally let someone else lead.',
        'After important interactions, ask "What could I have said or done differently to create more connection?"',
      ],
    },
    high: {
      strength: 'Builds trust across levels, resolves conflict constructively, and energizes teams.',
      weakness: 'Maintaining depth of relationships at scale; avoiding superficiality as your network grows.',
      actions: [
        'Formally mentor someone in relationship-building and document what you teach them.',
        'Develop a cross-functional initiative that requires deep collaboration; use it to role-model social leadership.',
        'Audit relationship depth: are you investing equally in upward, peer, and downward relationships?',
        'Design team rituals that strengthen connection and psychological safety for everyone.',
        'Use your influence to sponsor high-potential team members who lack your social ease.',
      ],
    },
  },
};

function getBand(avg) {
  if (avg >= 4) return 'high';
  if (avg >= 2.5) return 'mid';
  return 'low';
}

function getBandLabel(avg) {
  if (avg >= 4) return 'Strength';
  if (avg >= 2.5) return 'Developing';
  return 'Growth Area';
}

// ─── PDF builder ────────────────────────────────────────────────────────────

export function generateEQReport(record, personName = '', personRole = '') {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGE_W = 595;
  const MARGIN = 48;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 0;

  // ── helpers ──
  function newPage() {
    pdf.addPage();
    y = MARGIN;
  }

  function checkSpace(needed) {
    if (y + needed > 820) newPage();
  }

  function text(str, x, fontSize = 11, color = [30, 41, 59], bold = false, maxWidth = null) {
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    if (maxWidth) {
      const lines = pdf.splitTextToSize(str, maxWidth);
      pdf.text(lines, x, y);
      return lines.length * (fontSize * 1.45);
    }
    pdf.text(str, x, y);
    return fontSize * 1.45;
  }

  function rect(x, rx, w, h, r, fillColor) {
    pdf.setFillColor(...fillColor);
    pdf.roundedRect(x, rx, w, h, r, r, 'F');
  }

  // ── COVER ──
  // Navy header band
  rect(0, 0, PAGE_W, 180, 0, [15, 32, 68]);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('EQ Assessment Report', MARGIN, 72);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(153, 246, 228);
  pdf.text('Emotional Intelligence — Strengths, Growth Areas & Action Plan', MARGIN, 92);

  pdf.setFontSize(10);
  pdf.setTextColor(200, 220, 255);
  const dateStr = record.savedAt
    ? new Date(record.savedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  pdf.text(`${record.label}   ·   ${dateStr}`, MARGIN, 115);

  // Overall score pill
  const overallColor = record.overall >= 4 ? [13, 148, 136] : record.overall >= 3 ? [245, 158, 11] : [239, 68, 68];
  rect(MARGIN, 138, 120, 32, 8, overallColor);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Overall: ${record.overall}/5`, MARGIN + 12, 159);

  // Name + Role block (white card below header band)
  y = 192;
  if (personName || personRole) {
    rect(MARGIN, y, CONTENT_W, 44, 8, [255, 255, 255]);
    // thin left accent bar
    rect(MARGIN, y, 4, 44, 2, overallColor);

    if (personName) {
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 32, 68);
      pdf.text(personName, MARGIN + 16, y + 17);
    }
    if (personRole) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(personRole, MARGIN + 16, y + 33);
    }
    y += 58;
  } else {
    y = 210;
  }

  // ── SUMMARY ROW ──
  const dims = record.dimResults || [];
  const colW = CONTENT_W / dims.length;
  dims.forEach((d, i) => {
    const x = MARGIN + i * colW;
    const band = getBand(d.avg);
    const bgColor = band === 'high' ? [240, 253, 250] : band === 'mid' ? [255, 251, 235] : [254, 242, 242];
    const txColor = band === 'high' ? [13, 148, 136] : band === 'mid' ? [180, 83, 9] : [220, 38, 38];
    rect(x + 4, y, colW - 8, 72, 8, bgColor);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...txColor);
    const labelLines = pdf.splitTextToSize(d.label, colW - 20);
    pdf.text(labelLines, x + 10, y + 18);

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(d.avg || '—'), x + 10, y + 50);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(getBandLabel(d.avg), x + 10, y + 64);
  });
  y += 88;

  // Strongest / Weakest callout
  if (record.strongest || record.weakest) {
    checkSpace(36);
    rect(MARGIN, y, CONTENT_W, 30, 6, [248, 250, 252]);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    let callout = '';
    if (record.strongest) callout += `Top strength: ${record.strongest}`;
    if (record.weakest) callout += `   ·   Priority growth area: ${record.weakest}`;
    pdf.text(callout, MARGIN + 12, y + 20);
    y += 44;
  }

  // ── PER-DIMENSION SECTIONS ──
  dims.forEach(d => {
    const rec = RECS[d.id];
    if (!rec) return;
    const band = getBand(d.avg);
    const data = rec[band];
    const bandColor = band === 'high' ? [13, 148, 136] : band === 'mid' ? [180, 83, 9] : [220, 38, 38];
    const bandBg   = band === 'high' ? [240, 253, 250] : band === 'mid' ? [255, 251, 235] : [254, 242, 242];

    checkSpace(120);

    // Section header
    rect(MARGIN, y, CONTENT_W, 32, 6, [15, 32, 68]);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(rec.label, MARGIN + 12, y + 21);

    // Score badge in header
    const badgeLabel = `${d.avg}/5  ${getBandLabel(d.avg)}`;
    pdf.setFontSize(9);
    pdf.setTextColor(200, 230, 255);
    const badgeW = pdf.getTextWidth(badgeLabel) + 16;
    rect(MARGIN + CONTENT_W - badgeW - 4, y + 6, badgeW, 20, 5, [30, 58, 110]);
    pdf.setTextColor(200, 230, 255);
    pdf.text(badgeLabel, MARGIN + CONTENT_W - badgeW + 4, y + 20);
    y += 44;

    // Strength
    if (data.strength) {
      checkSpace(40);
      rect(MARGIN, y, CONTENT_W, 26, 5, [240, 253, 250]);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(13, 148, 136);
      pdf.text('STRENGTH', MARGIN + 10, y + 11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      const sLines = pdf.splitTextToSize(data.strength, CONTENT_W - 100);
      pdf.text(sLines, MARGIN + 80, y + 11);
      y += Math.max(26, sLines.length * 13) + 6;
    }

    // Weakness / focus
    if (data.weakness) {
      checkSpace(40);
      const wLines = pdf.splitTextToSize(data.weakness, CONTENT_W - 100);
      const wH = Math.max(26, wLines.length * 13);
      rect(MARGIN, y, CONTENT_W, wH, 5, bandBg);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...bandColor);
      pdf.text(band === 'high' ? 'WATCH OUT' : 'FOCUS AREA', MARGIN + 10, y + 13);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      pdf.text(wLines, MARGIN + 92, y + 13);
      y += wH + 8;
    }

    // Actions
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    checkSpace(18);
    pdf.text('RECOMMENDED ACTIONS:', MARGIN, y);
    y += 14;

    data.actions.forEach((action, ai) => {
      const lines = pdf.splitTextToSize(action, CONTENT_W - 20);
      const lineH = lines.length * 13 + 8;
      checkSpace(lineH + 4);

      // Bullet circle
      pdf.setFillColor(...bandColor);
      pdf.circle(MARGIN + 6, y + 5, 3, 'F');

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      pdf.text(lines, MARGIN + 16, y + 9);
      y += lineH;
    });

    y += 16; // spacing between dimensions
  });

  // ── FOOTER on all pages ──
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Accountability App — EQ Assessment Report — Confidential', MARGIN, 830);
    pdf.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN - 50, 830);
  }

  // ── trigger download ──
  const filename = `EQ-Report-${(record.label || 'assessment').replace(/[^a-z0-9]/gi, '-')}.pdf`;
  pdf.save(filename);
}
