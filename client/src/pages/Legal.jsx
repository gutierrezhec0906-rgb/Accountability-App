import { Link } from 'react-router-dom';
import { LEGAL_META, TERMS_SECTIONS, PRIVACY_SECTIONS } from '../legal/legalContent';

// Renders a legal document (Terms or Privacy) from the shared content module so
// the in-app copy always matches the exported Word document. Public pages —
// reachable before login and linked from the signup form and footer.
function LegalPage({ title, subtitle, sections }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1e3a6e 60%, #0d9488 100%)', color: 'white', borderRadius: '16px 16px 0 0', padding: '1.75rem 2rem' }}>
          <Link to="/login" style={{ color: '#99f6e4', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>← Back to sign in</Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '10px 0 4px' }}>{title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>{subtitle}</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', margin: '8px 0 0' }}>
            Effective date: {LEGAL_META.effectiveDate}
          </p>
        </div>
        <div style={{ background: 'white', borderRadius: '0 0 16px 16px', padding: '1.75rem 2rem', boxShadow: '0 12px 40px rgba(15,32,68,0.08)' }}>
          {sections.map(sec => (
            <section key={sec.heading} style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f2044', margin: '0 0 8px' }}>{sec.heading}</h2>
              {sec.paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.65, margin: '0 0 8px' }}>{p}</p>
              ))}
            </section>
          ))}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/terms" style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>Terms &amp; Conditions</Link>
            <Link to="/privacy" style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>Privacy Policy</Link>
            <a href={`mailto:${LEGAL_META.contactEmail}`} style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>{LEGAL_META.contactEmail}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Terms() {
  return <LegalPage title="Terms & Conditions" subtitle={`${LEGAL_META.appName} — please read these terms carefully.`} sections={TERMS_SECTIONS} />;
}

export function Privacy() {
  return <LegalPage title="Privacy Policy" subtitle={`How the ${LEGAL_META.appName} handles your data.`} sections={PRIVACY_SECTIONS} />;
}
