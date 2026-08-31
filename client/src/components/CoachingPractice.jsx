import { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const SCENARIOS = [
  { key: 'underperformance', icon: '📉', label: 'Underperforming Employee', desc: 'Jordan has missed deadlines and a quality issue — a bit defensive, possibly burnt out.' },
  { key: 'conflict',         icon: '⚡', label: 'Team Conflict',            desc: 'Sam feels unheard in a tense conflict with a coworker over shared responsibilities.' },
  { key: 'career',           icon: '🚀', label: 'Career Growth Conversation', desc: 'Alex is ambitious but unsure how to grow into leadership — enthusiastic, a little insecure.' },
  { key: 'resistance',       icon: '🚧', label: 'Resistance to Change',     desc: 'Casey is skeptical of a new process and worried it will slow things down.' },
  { key: 'disciplinary',     icon: '⚠️', label: 'Disciplinary Conversation', desc: 'Taylor is anxious and a bit defensive about a repeated conduct/attendance issue.' },
];

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function CoachingPractice({ onClose }) {
  const [scenario, setScenario] = useState(null);
  const [history, setHistory] = useState([]); // [{ role: 'coach'|'coachee', text }]
  const [typedMessage, setTypedMessage] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(''); // accumulated final speech while the mic button is held
  const audioRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, thinking]);

  // Push-to-talk: hold the mic button down to keep listening — a brief pause
  // to think no longer cuts you off and sends an incomplete sentence.
  // `continuous` keeps the recognizer running through pauses instead of
  // auto-stopping on silence; only releasing the button (or leaving the
  // window) ends the turn and sends whatever was said.
  function startListening() {
    const SR = getSpeechRecognition();
    if (!SR || thinking) return;
    transcriptRef.current = '';
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      let combined = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) combined += e.results[i][0].transcript;
      }
      transcriptRef.current = combined;
    };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    recognitionRef.current.onend = () => {
      setListening(false);
      const text = transcriptRef.current.trim();
      if (text) sendMessage(text);
    };
    recognitionRef.current.stop();
    recognitionRef.current = null;
  }

  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || thinking) return;
    const newHistory = [...history, { role: 'coach', text: trimmed }];
    setHistory(newHistory);
    setTypedMessage('');
    setThinking(true);
    try {
      const fn = httpsCallable(getFunctions(), 'coachingPracticeReply');
      const res = await fn({ scenario: scenario.key, history, message: trimmed });
      const { replyText, audioBase64 } = res.data || {};
      if (replyText) {
        setHistory(h => [...h, { role: 'coachee', text: replyText }]);
        if (audioBase64 && audioRef.current) {
          audioRef.current.src = `data:audio/mpeg;base64,${audioBase64}`;
          audioRef.current.play().catch(() => {});
        }
      }
    } catch (e) {
      toast.error(e?.message || 'Practice session failed — try again');
    }
    setThinking(false);
  }

  function endPractice() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    setScenario(null);
    setHistory([]);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 800, color: '#0f2044', margin: 0, fontSize: '1.05rem' }}>🎙️ AI Practice Conversation</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>Practice a real coaching conversation with an AI-powered coachee.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
        </div>

        {!scenario ? (
          <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 14 }}>Choose a scenario to practice:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCENARIOS.map(s => (
                <button key={s.key} onClick={() => setScenario(s)}
                  style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.9rem 1.1rem', cursor: 'pointer' }}>
                  <p style={{ fontWeight: 700, color: '#0f2044', margin: '0 0 3px', fontSize: '0.92rem' }}>{s.icon} {s.label}</p>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '0.75rem 1.5rem', background: '#f5f3ff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6d28d9' }}>{scenario.icon} Practicing: {scenario.label}</span>
              <button onClick={endPractice} style={{ background: 'none', border: '1px solid #ddd6fe', borderRadius: 8, color: '#6d28d9', fontWeight: 700, fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                ↺ Change Scenario
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
              {history.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>
                  {speechSupported ? 'Press and hold the mic to talk, release when you\'re done speaking.' : 'Type your opening line below to start the conversation.'}
                </p>
              )}
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: h.role === 'coach' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '0.6rem 0.9rem', borderRadius: 14, fontSize: '0.85rem', lineHeight: 1.5,
                    background: h.role === 'coach' ? '#0d9488' : '#f1f5f9',
                    color: h.role === 'coach' ? 'white' : '#1e293b',
                  }}>
                    {h.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '0.6rem 0.9rem', borderRadius: 14, background: '#f1f5f9', color: '#94a3b8', fontSize: '0.82rem' }}>{scenario.label.split(' ')[0]} is thinking…</div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <audio ref={audioRef} style={{ display: 'none' }} />

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
              {speechSupported && (
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onMouseLeave={() => { if (listening) stopListening(); }}
                  onTouchStart={e => { e.preventDefault(); startListening(); }}
                  onTouchEnd={e => { e.preventDefault(); stopListening(); }}
                  disabled={thinking}
                  title={listening ? 'Release to send' : 'Hold to talk'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0, fontSize: '1.2rem', cursor: 'pointer',
                    background: listening ? '#dc2626' : '#0d9488', color: 'white', userSelect: 'none', touchAction: 'none',
                    animation: listening ? 'pulse 1.2s infinite' : 'none',
                  }}>
                  🎤
                </button>
              )}
              <input
                className="input"
                value={typedMessage}
                onChange={e => setTypedMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !thinking) sendMessage(typedMessage); }}
                placeholder={speechSupported ? 'Or type instead…' : 'Type what you would say…'}
                style={{ flex: 1 }}
                disabled={thinking}
              />
              <button className="btn-primary" onClick={() => sendMessage(typedMessage)} disabled={thinking || !typedMessage.trim()}>
                Send
              </button>
            </div>
            <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }`}</style>
          </>
        )}
      </div>
    </div>
  );
}
