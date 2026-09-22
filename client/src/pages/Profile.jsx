import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { storage, db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { compressImage, withTimeout } from '../utils/image';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguagePicker from '../components/LanguagePicker';

const STATUS_KEYS = { pending: 'pending', approved: 'approved', rejected: 'rejected', active: 'active' };
function trStatus(t, status) { return t(`profile.statusValues.${STATUS_KEYS[status] || status}`, status); }
const ROLE_KEYS = { Leader: 'leader', Manager: 'manager', Supervisor: 'supervisor', 'Individual Contributor': 'individualContributor' };
function trRole(t, role) { return t(`signup.roles.${ROLE_KEYS[role] || role}`, role); }

function Avatar({ name, photoURL, size = 80 }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const colors = ['#0d9488', '#0f2044', '#7c3aed', '#be185d', '#b45309', '#065f46'];
  const color = colors[name?.charCodeAt(0) % colors.length] || '#0d9488';
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        style={{
          width: size, height: size, minWidth: size, minHeight: size, maxWidth: size, maxHeight: size,
          aspectRatio: '1 / 1', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center',
          display: 'block', boxSizing: 'border-box', flexShrink: 0, border: '3px solid #e2e8f0',
        }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, minWidth: size, minHeight: size, aspectRatio: '1 / 1', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { currentUser, userProfile, fetchProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const reminderLevel = userProfile?.reminderLevel || 'medium';
  const fileRef = useRef();

  const photoURL = userProfile?.photoURL || currentUser?.photoURL || null;

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('profile.toast.chooseImageFile', 'Please choose an image file')); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error(t('profile.toast.imageTooLarge', 'Image is too large (max 25 MB)')); return; }
    setUploading(true);
    try {
      // Compress in the browser first so avatar uploads are fast on mobile.
      let uploadData = file, contentType = file.type;
      try {
        const { blob } = await compressImage(file, 512, 0.85); // avatars are small
        uploadData = blob; contentType = 'image/jpeg';
      } catch { /* fall back to the original file */ }
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await withTimeout(uploadBytes(storageRef, uploadData, { contentType }), 45000, 'Photo upload');
      const url = await withTimeout(getDownloadURL(storageRef), 15000, 'Photo link');
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
      await updateProfile(auth.currentUser, { photoURL: url });
      await fetchProfile(currentUser.uid);
      toast.success(t('profile.toast.photoUpdated', 'Profile photo updated!'));
    } catch (err) {
      toast.error(t('profile.toast.uploadFailed', 'Upload failed or timed out. Please try again.'));
    }
    setUploading(false);
  }

  async function handleSavePhone(e) {
    e.preventDefault();
    setSavingPhone(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { phoneNumber: phoneNumber.trim() });
      await fetchProfile(currentUser.uid);
      toast.success(phoneNumber.trim() ? t('profile.toast.phoneSaved', 'Phone number saved!') : t('profile.toast.phoneRemoved', 'Phone number removed'));
    } catch {
      toast.error(t('profile.toast.phoneSaveFailed', 'Failed to save phone number.'));
    }
    setSavingPhone(false);
  }

  async function handleSetReminderLevel(level) {
    if (level === reminderLevel || savingReminder) return;
    setSavingReminder(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { reminderLevel: level });
      await fetchProfile(currentUser.uid);
      toast.success(t('profile.toast.reminderSaved', 'Reminder setting saved!'));
    } catch {
      toast.error(t('profile.toast.reminderSaveFailed', 'Failed to save reminder setting.'));
    }
    setSavingReminder(false);
  }

  async function handleSaveName(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', currentUser.uid), { displayName: displayName.trim() });
      await fetchProfile(currentUser.uid);
      toast.success(t('profile.toast.nameUpdated', 'Name updated!'));
    } catch {
      toast.error(t('profile.toast.nameUpdateFailed', 'Failed to update name.'));
    }
    setSavingName(false);
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="space-y-6">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('profile.title', 'Profile Settings')}</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>{t('profile.subtitle', 'Manage your personal information and photo.')}</p>
      </div>

      {/* Language card */}
      <div className="card" style={{ padding: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{t('common.language')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>{t('common.english')} / {t('common.spanish')}</p>
        </div>
        <LanguagePicker />
      </div>

      {/* Photo card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>{t('profile.profilePhoto', 'Profile Photo')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={currentUser?.displayName} photoURL={photoURL} size={110} />
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>...</span>
              </div>
            )}
          </div>
          <div>
            <p style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem', margin: '0 0 2px' }}>{currentUser?.displayName || t('profile.user', 'User')}</p>
            {userProfile?.companyName && (
              <p style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.8rem', margin: '0 0 10px' }}>🏢 {userProfile.companyName}</p>
            )}
            <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 12 }}>
              {t('profile.uploadPhotoHint', 'Upload a photo to personalize your profile. It will appear on the Team page and sidebar.')}
            </p>
            <button
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
              onClick={() => fileRef.current.click()}
              disabled={uploading}
            >
              {uploading ? t('profile.uploading', 'Uploading...') : `📷 ${t('profile.choosePhoto', 'Choose Photo')}`}
            </button>
            <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 8 }}>{t('profile.photoFormatHint', 'JPG, PNG or GIF · Max 5 MB')}</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>
        </div>
      </div>

      {/* Name card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>{t('profile.displayName', 'Display Name')}</h2>
        <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={t('profile.yourFullName', 'Your full name')}
          />
          <button className="btn-primary" type="submit" disabled={savingName || !displayName.trim()}>
            {savingName ? t('profile.saving', 'Saving...') : t('profile.save', 'Save')}
          </button>
        </form>
      </div>

      {/* Phone number card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>📱 {t('profile.phoneNumber', 'Phone Number')}</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 16 }}>
          {t('profile.phoneNumberHint', 'Add your phone number to receive a text message whenever a new action item is created on the Accountability Board. Leave blank to opt out.')}
        </p>
        <form onSubmit={handleSavePhone} style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            type="tel"
            style={{ flex: 1 }}
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+1 555 123 4567"
          />
          <button className="btn-primary" type="submit" disabled={savingPhone}>
            {savingPhone ? t('profile.saving', 'Saving...') : t('profile.save', 'Save')}
          </button>
        </form>
        <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 8 }}>{t('profile.phoneFormatHint', 'Use full international format, e.g. +1 for the US.')}</p>
      </div>

      {/* Inactivity reminder level */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>🔔 {t('profile.accountabilityReminders', 'Accountability Reminders')}</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 16 }}>
          {t('profile.remindersHint', 'Choose how the app follows up if you go quiet — a full week or more without opening it.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { key: 'none',       label: 'No Reminders' },
            { key: 'medium',     label: 'Medium Reminders' },
            { key: 'aggressive', label: 'Aggressive Reminders' },
          ].map(opt => (
            <button key={opt.key} type="button" disabled={savingReminder} onClick={() => handleSetReminderLevel(opt.key)}
              style={{
                padding: '0.55rem 1.1rem', borderRadius: 9999, fontWeight: 700, fontSize: '0.8rem', cursor: savingReminder ? 'default' : 'pointer',
                border: reminderLevel === opt.key ? '1.5px solid #0d9488' : '1.5px solid #e2e8f0',
                background: reminderLevel === opt.key ? '#0d9488' : 'white',
                color: reminderLevel === opt.key ? 'white' : '#475569',
              }}>
              {t(`profile.reminderLevels.${opt.key}`, opt.label)}
            </button>
          ))}
        </div>
        {reminderLevel === 'none' && (
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>{t('profile.noRemindersNote', "You won't receive any inactivity reminders.")}</p>
        )}
        {reminderLevel === 'medium' && (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.7 }}>
            <li>{t('profile.medium.week1', 'Week 1 without using the app — no reminder')}</li>
            <li>{t('profile.medium.week2', 'Week 2 — 1st email reminder')}</li>
            <li>{t('profile.medium.week3', 'Week 3 — 2nd email reminder + text message')}</li>
            <li>{t('profile.medium.week4', 'Week 4+ — escalation email to your leader')}</li>
          </ul>
        )}
        {reminderLevel === 'aggressive' && (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.7 }}>
            <li>{t('profile.aggressive.week1', 'Week 1 without using the app — 1st email reminder')}</li>
            <li>{t('profile.aggressive.week2', 'Week 2 — 2nd email reminder + text message')}</li>
            <li>{t('profile.aggressive.week3', 'Week 3+ — escalation email to your leader')}</li>
          </ul>
        )}
        <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 12, marginBottom: 0 }}>{t('profile.textRemindersNote', 'Text reminders use the phone number above, if one is on file.')}</p>
      </div>

      {/* Read-only info */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>{t('profile.accountInfo', 'Account Info')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: t('profile.email', 'Email'), value: currentUser?.email },
            { label: t('profile.role', 'Role'), value: userProfile?.role ? trRole(t, userProfile.role) : null },
            { label: t('profile.status', 'Status'), value: userProfile?.status ? trStatus(t, userProfile.status) : null },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, minWidth: 60 }}>{label}</span>
              <span style={{ color: '#334155', fontSize: '0.875rem', fontWeight: 500 }}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ padding: '1.75rem', border: '1px solid #fecaca' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>{t('profile.dangerZone', 'Danger Zone')}</h2>
        <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 14, lineHeight: 1.6 }}>
          {t('profile.deleteAccountNote', 'Permanently delete your account and all associated data. This cannot be undone.')}
        </p>
        <Link
          to="/delete-account"
          style={{
            display: 'inline-block', padding: '0.55rem 1.1rem', borderRadius: 8,
            background: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: '0.82rem',
            textDecoration: 'none', border: '1px solid #fecaca',
          }}
        >
          {t('profile.deleteAccountLink', 'Delete My Account')}
        </Link>
      </div>
    </div>
  );
}
