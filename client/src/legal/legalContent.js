// Single source of truth for the app's legal copy. Both the in-app Terms /
// Privacy pages and the exported Word document are generated from this so the
// wording never drifts between them. NOTE: this is a lawyer-ready first draft,
// NOT legal advice — bracketed [PLACEHOLDERS] must be reviewed by counsel.

export const LEGAL_META = {
  appName: 'Accountability App',
  company: 'Leadership Flow', // legal entity — confirm with counsel
  contactEmail: 'hectorg@accountability-app.com',
  website: 'https://www.accountability-app.com',
  effectiveDate: 'July 27, 2026',
  governingLaw: '[State/Country — to be confirmed with counsel]',
};

export const TERMS_SECTIONS = [
  {
    heading: '1. Acceptance of These Terms',
    paragraphs: [
      `These Terms & Conditions ("Terms") form a binding agreement between you and ${LEGAL_META.company} ("we", "us", "our"), the provider of the ${LEGAL_META.appName} (the "App" or "Service"). By creating an account, accessing, or using the Service, you agree to be bound by these Terms and by our Privacy Policy, which is incorporated by reference.`,
      `If you are accepting these Terms on behalf of a company, team, or other organization, you represent that you have the authority to bind that organization, and "you" refers to both you and that organization.`,
      `If you do not agree to these Terms, do not use the Service.`,
    ],
  },
  {
    heading: '2. Eligibility',
    paragraphs: [
      `You must be at least 18 years old (or the age of majority in your jurisdiction) and legally able to enter into a contract to use the Service. The Service is intended for workplace and professional-development use.`,
    ],
  },
  {
    heading: '3. Accounts and Registration',
    paragraphs: [
      `You must provide accurate and complete information when registering and keep it up to date. New accounts may require approval by an administrator before access is granted.`,
      `You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Accounts are personal to you and may not be shared. Notify us promptly of any unauthorized use.`,
    ],
  },
  {
    heading: '4. Description of the Service',
    paragraphs: [
      `The Service is a leadership-accountability platform that provides tools for goal-setting, self- and peer-assessment, coaching and mentoring logs, career planning, and related activities, together with an automatically calculated "Accountability Score," dashboards, and periodic reports.`,
      `IMPORTANT: The Accountability Score, assessments (including DISC, EQ, and skills tools), dashboards, and reports are informational and developmental tools only. They are not clinical, diagnostic, or professional evaluations and are not intended to be the sole basis for any hiring, promotion, compensation, disciplinary, or other employment decision. You are solely responsible for any decisions you make using the Service.`,
      `We may add, modify, suspend, or discontinue features of the Service at any time.`,
    ],
  },
  {
    heading: '5. Acceptable Use',
    paragraphs: [
      `You agree not to: (a) use the Service for any unlawful, harassing, defamatory, discriminatory, or abusive purpose; (b) upload content that infringes others’ rights or that is false, misleading, or harmful; (c) attempt to gain unauthorized access to any account, system, or data; (d) reverse-engineer, scrape, copy, or resell the Service except as permitted by law; (e) interfere with or disrupt the integrity or performance of the Service; or (f) upload viruses or malicious code.`,
      `We may remove content or suspend accounts that violate these Terms.`,
    ],
  },
  {
    heading: '6. User Content and Data',
    paragraphs: [
      `"User Content" means the information you or your organization submit to the Service, including goals, assessments, feedback, coaching and mentoring notes, career plans, and similar entries. As between you and us, you and your organization retain ownership of your User Content.`,
      `You grant us a limited, non-exclusive, worldwide license to host, store, process, transmit, and display User Content solely as necessary to operate and provide the Service to you and your authorized organization members (for example, enabling a manager to view the Accountability Scores of their direct reports where such visibility has been configured).`,
      `Within an organization, certain content is shared by design — for example, peer assessments are shared with the person being assessed, and administrators or designated leaders may view team members’ scores and progress. You acknowledge and consent to this sharing within your organization.`,
      `We may generate and use aggregated and de-identified data (which does not identify you) to operate, improve, and develop the Service.`,
    ],
  },
  {
    heading: '7. Third-Party Services',
    paragraphs: [
      `The Service relies on third-party providers, including Google Firebase (authentication, database, hosting, and cloud functions) and an email delivery provider used to send transactional messages such as welcome emails, reminders, and weekly reports. Your use of the Service is also subject to those providers’ terms where applicable. We are not responsible for third-party services outside our control.`,
    ],
  },
  {
    heading: '8. Intellectual Property',
    paragraphs: [
      `The Service, including its software, design, branding, the "five leadership pillars" framework, methodology, text, graphics, and all related intellectual property, is owned by ${LEGAL_META.company} or its licensors and is protected by law. We grant you a limited, revocable, non-transferable, non-exclusive license to access and use the Service for its intended purpose. No rights are granted except as expressly stated in these Terms.`,
    ],
  },
  {
    heading: '9. Fees and Subscriptions',
    paragraphs: [
      `Some features of the Service may be offered free of charge and others may require a paid subscription. Where fees apply, pricing, billing frequency, renewal, and refund terms will be presented to you at the point of purchase. Fees are exclusive of taxes unless stated. We may change pricing on prospective notice. Failure to pay may result in suspension or termination of paid features.`,
    ],
  },
  {
    heading: '10. Termination',
    paragraphs: [
      `You may stop using the Service and request deletion of your account at any time. We may suspend or terminate your access if you violate these Terms, if required by law, or if we discontinue the Service.`,
      `Upon termination, your right to use the Service ends. We will handle your data in accordance with our Privacy Policy, including providing a reasonable opportunity to export data where applicable and deleting data within a reasonable period, subject to legal retention obligations.`,
    ],
  },
  {
    heading: '11. Disclaimers',
    paragraphs: [
      `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT SCORES, ASSESSMENTS, OR REPORTS ARE ACCURATE OR SUITABLE FOR ANY PARTICULAR PURPOSE.`,
    ],
  },
  {
    heading: '12. Limitation of Liability',
    paragraphs: [
      `TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE, INCLUDING ANY EMPLOYMENT OR PERSONNEL DECISIONS MADE IN RELIANCE ON THE SERVICE.`,
      `OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).`,
    ],
  },
  {
    heading: '13. Indemnification',
    paragraphs: [
      `You agree to indemnify and hold harmless ${LEGAL_META.company} and its officers, employees, and agents from any claims, damages, liabilities, and expenses (including reasonable legal fees) arising from your User Content, your use of the Service, or your violation of these Terms or of applicable law.`,
    ],
  },
  {
    heading: '14. Governing Law and Disputes',
    paragraphs: [
      `These Terms are governed by the laws of ${LEGAL_META.governingLaw}, without regard to its conflict-of-laws rules. The parties agree to the exclusive jurisdiction of the courts located there, except where applicable law provides otherwise. [Counsel to advise on arbitration and class-action-waiver provisions.]`,
    ],
  },
  {
    heading: '15. Changes to These Terms',
    paragraphs: [
      `We may update these Terms from time to time. If we make material changes, we will notify you by email or through the Service. Your continued use of the Service after the changes take effect constitutes acceptance of the updated Terms.`,
    ],
  },
  {
    heading: '16. Contact Us',
    paragraphs: [
      `Questions about these Terms? Contact us at ${LEGAL_META.contactEmail}.`,
    ],
  },
];

export const PRIVACY_SECTIONS = [
  {
    heading: '1. Introduction',
    paragraphs: [
      `This Privacy Policy explains how ${LEGAL_META.company} ("we", "us", "our") collects, uses, shares, and protects personal information when you use the ${LEGAL_META.appName} (the "Service"). By using the Service, you agree to this Policy.`,
    ],
  },
  {
    heading: '2. Information We Collect',
    paragraphs: [
      `Account information: your name, email address, role, and the company or team you belong to.`,
      `Content you provide: SMART goals, vision statements, DISC and EQ assessment results, skills self-assessments and peer assessments, coaching and mentoring notes, career-development plans, feedback, and similar entries. Some of this information is reflective or evaluative in nature and should be treated as sensitive.`,
      `Usage information: activity within the Service (such as tools used and session timestamps), which is used to calculate your Accountability Score and to improve the Service.`,
      `Technical information: information stored locally in your browser or device (such as local storage used to remember which walkthrough videos you have seen).`,
    ],
  },
  {
    heading: '3. How We Use Your Information',
    paragraphs: [
      `We use your information to: provide and operate the Service; calculate scores and generate dashboards and reports; send transactional emails such as welcome messages, reminders, and weekly reports; enable authorized sharing within your organization; maintain security; and improve and develop the Service.`,
    ],
  },
  {
    heading: '4. How Information Is Shared Within Your Organization',
    paragraphs: [
      `The Service is designed for team and organizational use. Depending on configuration: administrators may view members’ information across their organization; designated leaders or managers may view the Accountability Scores and progress of their direct reports where such visibility has been granted; and peer assessments are shared with the person being assessed. Please be aware of this when entering content.`,
    ],
  },
  {
    heading: '5. Service Providers (Sub-Processors)',
    paragraphs: [
      `We use trusted third-party providers to run the Service, including Google Firebase for authentication, database, hosting, and cloud functions, and an email delivery provider for transactional email. These providers process data on our behalf and are subject to their own security and privacy commitments.`,
    ],
  },
  {
    heading: '6. Data Retention and Deletion',
    paragraphs: [
      `We retain your information for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data, and administrators can delete user accounts. We will delete or de-identify data within a reasonable period after a valid request, subject to legal obligations that may require retention.`,
    ],
  },
  {
    heading: '7. Your Rights',
    paragraphs: [
      `Depending on your location, you may have rights to access, correct, delete, or export your personal information, and to object to or restrict certain processing. To exercise these rights, contact us at ${LEGAL_META.contactEmail}. If you are in the EU/EEA, UK, or California, additional rights may apply under GDPR, UK GDPR, or the CCPA/CPRA.`,
    ],
  },
  {
    heading: '8. Security',
    paragraphs: [
      `We use reasonable technical and organizational measures to protect your information, including authentication and access controls provided by our infrastructure providers. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.`,
    ],
  },
  {
    heading: '9. Children',
    paragraphs: [
      `The Service is not directed to individuals under 18, and we do not knowingly collect personal information from them.`,
    ],
  },
  {
    heading: '10. International Users and Data Transfers',
    paragraphs: [
      `We are based in the United States and use service providers, including Google Firebase, that store and process data on servers that may be located in the United States and other countries. This means your information may be transferred to, stored in, and processed in a country different from the one in which you live.`,
      `Where personal data of individuals in the European Economic Area (EEA), the United Kingdom, or Switzerland is transferred to the United States, we rely on our service providers’ safeguards for such transfers, including the EU–U.S. Data Privacy Framework and/or the European Commission’s Standard Contractual Clauses, as applicable. Google Cloud / Firebase, our primary infrastructure provider, offers these mechanisms.`,
    ],
  },
  {
    heading: '11. Your Rights in the EEA, UK, and Switzerland (GDPR)',
    paragraphs: [
      `If you are located in the European Economic Area, the United Kingdom, or Switzerland, the General Data Protection Regulation (GDPR) and equivalent laws give you specific rights over your personal data. We act as a data controller for the personal data you provide through the Service.`,
      `Legal basis for processing: we process your personal data based on (a) your consent, which you give when you register and accept these policies and which you may withdraw at any time; (b) our legitimate interests in operating, securing, and improving the Service; and (c) where applicable, performance of a contract with you or your organization.`,
      `Your rights include: the right to access the personal data we hold about you; the right to rectification of inaccurate data; the right to erasure ("right to be forgotten"); the right to restrict or object to certain processing; the right to data portability (to receive your data in a portable format); and the right to withdraw consent at any time without affecting processing already carried out.`,
      `To exercise any of these rights, contact us at ${LEGAL_META.contactEmail}. We will respond within the timeframes required by applicable law.`,
      `You also have the right to lodge a complaint with your local data protection authority. In the Netherlands, this is the Autoriteit Persoonsgegevens (Dutch Data Protection Authority). You may also contact the supervisory authority in your country of residence or work.`,
      `We retain your personal data only as long as necessary for the purposes described in this Policy or as required by law, after which it is deleted or de-identified.`,
    ],
  },
  {
    heading: '12. Changes to This Policy',
    paragraphs: [
      `We may update this Privacy Policy from time to time. We will post the updated version and, where appropriate, notify you by email or through the Service.`,
    ],
  },
  {
    heading: '13. Contact Us',
    paragraphs: [
      `Questions about this Privacy Policy or your data? Contact us at ${LEGAL_META.contactEmail}.`,
    ],
  },
];
