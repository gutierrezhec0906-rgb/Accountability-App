import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TIER_ICONS } from '../utils/subscription';
import PageHeader from '../components/PageHeader';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: '🆓',
    color: '#475569',
    bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',
    border: '#cbd5e1',
    cta: 'Current Plan',
    ctaStyle: { background: '#e2e8f0', color: '#475569' },
    features: [
      '✅ Dashboard & Accountability Score',
      '✅ Coaching Log',
      '✅ Feedback Box',
      '✅ Leadership Quotes',
      '✅ SMART Goals',
      '✅ Score Tracker',
      '—  Advanced leadership tools',
      '—  Training videos',
      '—  Expert coaching sessions',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'Contact Us',
    period: 'subscription',
    icon: '⭐',
    color: '#1d4ed8',
    bg: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    border: '#93c5fd',
    badge: 'Most Popular',
    cta: 'Upgrade to Premium',
    ctaStyle: { background: '#2563eb', color: 'white' },
    features: [
      '✅ Everything in Free',
      '✅ The Accountability Board',
      '✅ Line of Balance',
      '✅ Sense of Urgency',
      '✅ EQ & OpEx Tools',
      '✅ Vision Builder',
      '✅ Mindfulness',
      '✅ Lean Toolkit',
      '✅ Problem Solving',
      '✅ DISC Assessment',
      '✅ Skills Development',
      '✅ Training Center & Videos',
      '✅ Mentoring Tracker',
      '✅ Career Development',
      '—  Personal coaching w/ experts',
    ],
  },
  {
    id: 'all-inclusive',
    name: 'All-Inclusive',
    price: 'Contact Us',
    period: 'subscription',
    icon: '👑',
    color: '#7e22ce',
    bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)',
    border: '#c4b5fd',
    badge: 'Best Value',
    cta: 'Go All-Inclusive',
    ctaStyle: { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white' },
    features: [
      '✅ Everything in Premium',
      '✅ Personal Coaching w/ Master Experts',
      '✅ Ultimate Leadership Tools',
      '✅ Exclusive Downloads & Resources',
      '✅ Advanced Assessment Reports',
      '✅ Priority Support',
      '✅ Early Access to New Features',
    ],
  },
];

export default function Pricing() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const currentTier = userProfile?.subscriptionTier || 'free';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }} className="space-y-6">
      <PageHeader
        icon="💎"
        title="Plans & Pricing"
        subtitle="Choose the plan that matches your leadership journey. Upgrade anytime."
      />

      {/* Current tier banner */}
      <div style={{
        borderRadius: 12, padding: '0.875rem 1.25rem',
        background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
        border: '1px solid #bbf7d0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: '1.25rem' }}>{TIER_ICONS[currentTier]}</span>
        <div>
          <p style={{ fontWeight: 700, color: '#15803d', margin: 0, fontSize: '0.875rem' }}>
            Your current plan: <strong>{currentTier === 'all-inclusive' ? 'All-Inclusive' : currentTier === 'premium' ? 'Premium' : 'Free'}</strong>
          </p>
          {currentTier === 'free' && (
            <p style={{ color: '#166534', fontSize: '0.72rem', margin: 0 }}>
              Upgrade to unlock all 13 advanced leadership tools and training videos.
            </p>
          )}
          {currentTier === 'premium' && (
            <p style={{ color: '#166534', fontSize: '0.72rem', margin: 0 }}>
              Go All-Inclusive to add personal coaching with master experts.
            </p>
          )}
          {currentTier === 'all-inclusive' && (
            <p style={{ color: '#166534', fontSize: '0.72rem', margin: 0 }}>
              You have full access to every feature in the app.
            </p>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {plans.map(plan => {
          const isCurrentPlan = plan.id === currentTier;
          return (
            <div key={plan.id} style={{
              borderRadius: 16, overflow: 'hidden',
              border: `2px solid ${isCurrentPlan ? plan.border : '#e2e8f0'}`,
              boxShadow: isCurrentPlan ? `0 4px 24px ${plan.border}80` : '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{ background: plan.bg, padding: '1.5rem', position: 'relative' }}>
                {plan.badge && (
                  <span style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'rgba(255,255,255,0.2)', color: 'white',
                    fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase', borderRadius: 99, padding: '3px 10px',
                  }}>
                    {plan.badge}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.5rem' }}>{plan.icon}</span>
                  <span style={{ color: 'white', fontWeight: 900, fontSize: '1.125rem' }}>{plan.name}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 2px', lineHeight: 1 }}>
                  {plan.price}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: 0 }}>{plan.period}</p>
              </div>

              {/* Features */}
              <div style={{ flex: 1, padding: '1.25rem', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {plan.features.map((f, i) => (
                  <p key={i} style={{
                    fontSize: '0.8rem', margin: 0, lineHeight: 1.5,
                    color: f.startsWith('—') ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: f.startsWith('✅') ? 500 : 400,
                  }}>{f}</p>
                ))}
              </div>

              {/* CTA */}
              <div style={{ padding: '1rem 1.25rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
                {isCurrentPlan ? (
                  <div style={{ textAlign: 'center', padding: '0.6rem', borderRadius: 10, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '0.875rem' }}>
                    ✓ Current Plan
                  </div>
                ) : (
                  <a
                    href="mailto:contact@yourapp.com?subject=Subscription Inquiry - {plan.name}"
                    style={{
                      display: 'block', textAlign: 'center', padding: '0.6rem 1rem',
                      borderRadius: 10, fontWeight: 700, fontSize: '0.875rem',
                      cursor: 'pointer', textDecoration: 'none',
                      ...plan.ctaStyle,
                    }}
                  >
                    {plan.cta} →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expert coaching highlight (All-Inclusive) */}
      <div style={{
        borderRadius: 16, overflow: 'hidden',
        border: '2px solid #e9d5ff',
        background: 'linear-gradient(135deg,#fdf4ff,#f5f3ff)',
      }}>
        <div style={{ padding: '1.5rem', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
            🎓
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 900, color: '#4c1d95', fontSize: '1rem', margin: '0 0 4px' }}>Expert Coaching — All-Inclusive Exclusive</p>
            <p style={{ color: '#6d28d9', fontSize: '0.8rem', margin: '0 0 10px', lineHeight: 1.6 }}>
              Work 1-on-1 with master leadership coaches. Personalized sessions, actionable feedback, and accountability built around your specific goals.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['1-on-1 Sessions', 'Expert Mentors', 'Custom Growth Plan', 'Priority Access'].map(tag => (
                <span key={tag} style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '0.7rem', fontWeight: 700, borderRadius: 99, padding: '3px 10px' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <span style={{ display: 'inline-block', background: '#7c3aed', color: 'white', borderRadius: 10, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.875rem' }}>
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* FAQ / note */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', fontSize: '0.9rem' }}>How subscriptions work</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['How do I upgrade?', 'Contact your administrator or reach out to us. Your account will be upgraded within 24 hours.'],
            ['Can I change plans?', 'Yes — upgrade or downgrade at any time. Changes take effect immediately.'],
            ['What happens to my data if I downgrade?', 'Your data is always safe. You just lose access to premium features until you upgrade again.'],
          ].map(([q, a]) => (
            <div key={q} style={{ borderRadius: 10, background: '#f8fafc', padding: '0.75rem 1rem' }}>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', fontSize: '0.8rem' }}>{q}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
