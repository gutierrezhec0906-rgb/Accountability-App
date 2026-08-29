import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { storage, db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { compressImage, withTimeout } from '../utils/image';
import toast from 'react-hot-toast';

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
  const { currentUser, userProfile, fetchProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const fileRef = useRef();

  const photoURL = userProfile?.photoURL || currentUser?.photoURL || null;

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('Image is too large (max 25 MB)'); return; }
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
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error('Upload failed or timed out. Please try again.');
    }
    setUploading(false);
  }

  async function handleSavePhone(e) {
    e.preventDefault();
    setSavingPhone(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { phoneNumber: phoneNumber.trim() });
      await fetchProfile(currentUser.uid);
      toast.success(phoneNumber.trim() ? 'Phone number saved!' : 'Phone number removed');
    } catch {
      toast.error('Failed to save phone number.');
    }
    setSavingPhone(false);
  }

  async function handleSaveName(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', currentUser.uid), { displayName: displayName.trim() });
      await fetchProfile(currentUser.uid);
      toast.success('Name updated!');
    } catch {
      toast.error('Failed to update name.');
    }
    setSavingName(false);
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="space-y-6">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Profile Settings</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>Manage your personal information and photo.</p>
      </div>

      {/* Photo card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Profile Photo</h2>
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
            <p style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem', margin: '0 0 2px' }}>{currentUser?.displayName || 'User'}</p>
            {userProfile?.companyName && (
              <p style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.8rem', margin: '0 0 10px' }}>🏢 {userProfile.companyName}</p>
            )}
            <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 12 }}>
              Upload a photo to personalize your profile. It will appear on the Team page and sidebar.
            </p>
            <button
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
              onClick={() => fileRef.current.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : '📷 Choose Photo'}
            </button>
            <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 8 }}>JPG, PNG or GIF · Max 5 MB</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>
        </div>
      </div>

      {/* Name card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Display Name</h2>
        <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 10 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your full name"
          />
          <button className="btn-primary" type="submit" disabled={savingName || !displayName.trim()}>
            {savingName ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      {/* Phone number card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>📱 Phone Number</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 16 }}>
          Add your phone number to receive a text message whenever a new action item is created on the Accountability Board. Leave blank to opt out.
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
            {savingPhone ? 'Saving...' : 'Save'}
          </button>
        </form>
        <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 8 }}>Use full international format, e.g. +1 for the US.</p>
      </div>

      {/* Read-only info */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Account Info</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Email', value: currentUser?.email },
            { label: 'Role', value: userProfile?.role },
            { label: 'Status', value: userProfile?.status },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, minWidth: 60 }}>{label}</span>
              <span style={{ color: '#334155', fontSize: '0.875rem', fontWeight: 500 }}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
