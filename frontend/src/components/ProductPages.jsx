import React from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  Command,
  Mail,
  MessageCircle,
  Monitor,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

const EMAIL = 'abhishek.tiwarii9821@gmail.com'
const LINKEDIN = 'https://www.linkedin.com/in/abhishek-tiwari-3a3594300/'
export const publicViews = ['home', 'contact', 'faq', 'privacy']
const faqs = [
  [
    'What is APPLE?',
    'APPLE is an independent personal assistant for macOS, created by Abhishek Tiwari. Talk, ask about your documents, practise with a voice teacher, and request supported computer actions. It is not affiliated with Apple Inc.',
  ],
  [
    'What do I need to run it?',
    'A Mac, a running local APPLE server, and Ollama with a downloaded model for reasoning and document teaching. Desktop Chrome supports voice input and the floating companion. Basic app launches and searches can work without a model.',
  ],
  [
    'Can it control every application?',
    'It discovers installed apps and works with controls exposed by macOS Accessibility. Some apps and web apps cannot be controlled reliably. APPLE reports these limitations; it does not promise unrestricted control of every app.',
  ],
  [
    'How do I use it without typing?',
    'Open Assistant and choose Start listening. Allow microphone access, then speak naturally. Final speech submits automatically. Say “stop listening” to end. Where speaker echo cancellation is available, you can speak over a reply; otherwise use Interrupt.',
  ],
  [
    'How does the floating companion work?',
    'In desktop Chrome, choose Float assistant. A small window stays above other applications and shares your existing session. Drag its title bar wherever you like. Keep the original APPLE tab open. Closing the companion ends its active voice session.',
  ],
  [
    'How do WhatsApp contacts work?',
    'Save the exact WhatsApp display name, international number and voice aliases in Settings. APPLE opens the installed WhatsApp app and verifies the recipient and message before sending. Native control needs Accessibility permission.',
  ],
  [
    'Can I learn from documents?',
    'Upload PDF, DOCX, TXT or Markdown. APPLE can answer from excerpts and ask short spoken practice questions with feedback. Scanned image-only PDFs need OCR first. AI answers and grades can contain mistakes, so check the source.',
  ],
  [
    'Is everything offline?',
    'Model reasoning and Mac speech synthesis are local. Browser dictation may send audio to its speech provider and require internet. Messaging, web searches and external links also use the internet.',
  ],
  [
    'Can I remove my history?',
    'Yes. Activity lets you search, select and permanently delete individual entries, selected entries or the entire activity history. This also removes those records from future conversation context. Documents, contacts, saved memories and study answers are managed separately.',
  ],
  [
    'Can I turn off sounds and animations?',
    'Interface sounds have their own switch and volume in Settings. They pause during voice sessions to protect dictation. Light and dark themes save in this browser, and animations follow your system’s reduced-motion preference.',
  ],
]
function Mark() {
  return (
    <svg viewBox="0 0 180 180" fill="currentColor" aria-hidden="true">
      <path d="M91 46C62 34 37 50 32 78C26 109 46 139 72 143C91 146 103 134 110 117C85 127 66 114 64 95C61 72 74 57 91 46Z" />
      <path
        opacity=".6"
        d="M91 46C114 39 139 52 145 79C153 112 133 141 108 143C90 144 76 132 71 116C96 128 115 115 117 96C120 76 109 57 91 46Z"
      />
      <path d="M94 34C95 19 106 12 120 14C119 28 109 37 94 34Z" />
    </svg>
  )
}
export function ProductFooter({ navigate, compact = false }) {
  return (
    <footer className={`product-footer${compact ? ' compact' : ''}`}>
      <div>
        <button className="footer-brand" onClick={() => navigate('home')}>
          APPLE<span>By Abhishek Tiwari</span>
        </button>
        {!compact && <p>A little help. A little more possibility.</p>}
      </div>
      <nav aria-label="Footer navigation">
        {[
          ['home', 'About APPLE'],
          ['faq', 'FAQs'],
          ['privacy', 'Privacy policy'],
          ['contact', 'Contact & support'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault()
              navigate(id)
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      {!compact && (
        <div className="footer-contact">
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer">
            LinkedIn <ArrowUpRight size={12} />
          </a>
          <small>© {new Date().getFullYear()} Abhishek Tiwari · Independent software</small>
        </div>
      )}
    </footer>
  )
}
export default function ProductPages({ view, navigate }) {
  const reduced = useReducedMotion()
  return (
    <div className="product-page">
      {view === 'home' && (
        <>
          <section className="product-hero">
            <div className="hero-copy">
              <span className="product-kicker">
                <span /> PERSONAL INTELLIGENCE. ON YOUR MAC.
              </span>
              <h1>
                Less between
                <br />
                you and <em>done.</em>
              </h1>
              <p>
                A voice that listens. A workspace that remembers. A little help with the things that
                fill your day.
              </p>
              <div className="hero-actions">
                <button className="product-primary" onClick={() => navigate('assistant')}>
                  Meet your assistant <ArrowRight size={17} />
                </button>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById('how-it-works')
                      ?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' })
                  }}
                >
                  See how it works <ArrowUpRight size={15} />
                </a>
              </div>
              <span className="hero-requirements">
                Built for macOS · Local Ollama intelligence · Your pace
              </span>
            </div>
            <div className="hero-art" aria-label="APPLE assistant illustration">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <motion.div
                className="hero-emblem"
                animate={reduced ? {} : { y: [0, -9, 0], rotate: [0, 2, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Mark />
              </motion.div>
              <div className="hero-note note-one">
                <AudioLines size={16} />
                <span>“I’m listening.”</span>
                <i />
              </div>
              <div className="hero-note note-two">
                <Check size={15} />
                <span>A little more flow.</span>
              </div>
              <div className="hero-art-caption">APPLE / AT YOUR SERVICE</div>
            </div>
          </section>
          <div className="product-principles">
            <span>
              <Command size={15} /> Real computer actions
            </span>
            <span>
              <ShieldCheck size={15} /> Local model reasoning
            </span>
            <span>
              <AudioLines size={15} /> A conversation, not a form
            </span>
          </div>
          <section className="product-section">
            <div className="product-section-heading">
              <span className="product-kicker">ONE PLACE. A LITTLE MORE CAPABLE.</span>
              <h2>
                For the way
                <br />
                your day actually works.
              </h2>
              <p>Talk through an idea, find your focus, or turn a document into a conversation.</p>
            </div>
            <div className="feature-grid">
              {[
                [
                  AudioLines,
                  'Just say it.',
                  'Ask a question or give a task. Hear concise replies, with listening and speaking reflected in the living APPLE mark.',
                  '01',
                ],
                [
                  Monitor,
                  'A companion, wherever.',
                  'Bring the floating assistant above your other windows. Keep talking, type a quick request, or stop a task without switching back.',
                  '02',
                ],
                [
                  BookOpen,
                  'Make knowledge stick.',
                  'Add your notes and documents. Ask questions, practise aloud and get feedback, one question at a time.',
                  '03',
                ],
                [
                  MessageCircle,
                  'A little less switching.',
                  'Open installed apps, search supported controls and message saved WhatsApp contacts through the native Mac app.',
                  '04',
                ],
              ].map(([Icon, title, copy, number]) => (
                <article className="feature-card" key={title}>
                  <div>
                    <Icon size={22} />
                    <span>{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>
          <section id="how-it-works" className="product-section setup-section">
            <div>
              <span className="product-kicker">A SMALL SETUP. YOUR OWN WORKSPACE.</span>
              <h2>
                Make yourself
                <br />
                at home.
              </h2>
            </div>
            <ol>
              {[
                [
                  'Connect your intelligence',
                  'Start your local APPLE server and Ollama. Choose a downloaded model in Settings.',
                ],
                [
                  'Choose what feels right',
                  'Pick a theme, voice language and sound level. Enable supported automation if you want fewer confirmations.',
                ],
                [
                  'Start with a sentence',
                  'Choose Start listening, allow your microphone, and tell APPLE what you need.',
                ],
              ].map(([title, copy], i) => (
                <li key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="product-section privacy-promise">
            <ShieldCheck size={28} />
            <div>
              <span className="product-kicker">CLEAR ABOUT YOUR DATA</span>
              <h2>Your workspace stays on your Mac.</h2>
              <p>
                Conversations, documents and saved contacts are stored locally. Browser dictation
                and actions you request can use online services. You choose what to keep.
              </p>
              <button className="product-text-link" onClick={() => navigate('privacy')}>
                Read the privacy policy <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <section className="product-section home-bottom">
            <div>
              <span className="product-kicker">MADE WITH INTENTION</span>
              <h2>
                A personal project.
                <br />A human behind it.
              </h2>
              <p>
                Created by Abhishek Tiwari. Have an idea, a question, or something that isn’t
                working? I’d like to hear it.
              </p>
            </div>
            <div>
              <button className="product-primary" onClick={() => navigate('contact')}>
                Get in touch <ArrowUpRight size={16} />
              </button>
              <button className="product-text-link" onClick={() => navigate('faq')}>
                A few common questions <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </>
      )}
      {view === 'faq' && (
        <section className="product-section info-page">
          <span className="product-kicker">A LITTLE CLARITY</span>
          <h1>
            Good questions.
            <br />
            Straight answers.
          </h1>
          <p className="info-intro">How APPLE works, what it needs, and where its limits are.</p>
          <div className="faq-list">
            {faqs.map(([question, answer], i) => (
              <details key={question}>
                <summary>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {question}
                  <span className="faq-plus">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <button className="product-text-link" onClick={() => navigate('contact')}>
            Still need a hand? Contact support <ArrowRight size={16} />
          </button>
        </section>
      )}
      {view === 'contact' && (
        <section className="product-section info-page contact-page">
          <span className="product-kicker">CONTACT & CUSTOMER SUPPORT</span>
          <h1>
            There’s a person
            <br />
            on the other side.
          </h1>
          <p className="info-intro">
            Questions, feedback, or a bug to work through. Reach out directly to the person building
            APPLE.
          </p>
          <div className="creator-card">
            <div className="creator-monogram">
              AT
              <span />
            </div>
            <div>
              <span className="product-kicker">CREATOR & DEVELOPER</span>
              <h2>Abhishek Tiwari</h2>
              <p>Building a more personal way to work with your computer.</p>
            </div>
          </div>
          <div className="contact-links">
            <a href={`mailto:${EMAIL}?subject=APPLE%20support`}>
              <Mail size={22} />
              <span>
                <small>EMAIL & SUPPORT</small>
                {EMAIL}
              </span>
              <ArrowUpRight size={20} />
            </a>
            <a href={LINKEDIN} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={22} />
              <span>
                <small>LET’S CONNECT</small>Abhishek on LinkedIn
              </span>
              <ArrowUpRight size={20} />
            </a>
          </div>
          <div className="support-note">
            <Sparkles size={18} />
            <p>
              For a bug report, include your macOS and browser versions, what you expected, and what
              happened. Remove private messages, phone numbers and document contents from
              screenshots before emailing.
            </p>
          </div>
        </section>
      )}
      {view === 'privacy' && (
        <section className="product-section info-page privacy-page">
          <span className="product-kicker">PRIVACY POLICY · UPDATED 3 OCTOBER 2026</span>
          <h1>
            Understand
            <br />
            what stays where.
          </h1>
          <p className="info-intro">
            This policy describes this local APPLE application, developed by Abhishek Tiwari. APPLE
            is independent software and is not affiliated with Apple Inc.
          </p>
          {[
            [
              'What APPLE stores',
              'Your Mac stores activity history and conversation text, imported document text, study questions and answers, saved contacts, explicit memories, routines and app settings. Browser preferences, including theme, language and interface sounds, use local browser storage.',
            ],
            [
              'Model reasoning and speech',
              'APPLE sends prompts and relevant document excerpts to Ollama running on this Mac. Spoken replies are generated by macOS and played locally; temporary speech files are removed after synthesis, and recent generated audio may be cached in memory. APPLE does not save raw microphone recordings. Browser dictation may send microphone audio to the browser’s speech provider under that provider’s policies.',
            ],
            [
              'When information leaves your Mac',
              'Web searches, opening external links, requested messages and browser dictation can contact online services. WhatsApp messages and recipient information are handled by the installed WhatsApp app. Choosing Email or LinkedIn opens those services; information you send there is governed by their policies. No advertising trackers or analytics are included in this build.',
            ],
            [
              'Your controls',
              'Start and end voice sessions explicitly. Microphone and macOS Accessibility permissions can be revoked through your browser and macOS settings. Trusted automation can be disabled in APPLE Settings. The floating assistant shares the current session and closes when its original tab closes.',
            ],
            [
              'Removing information',
              'Activity supports deleting individual records, selected records or all activity. Deleted history is excluded from future conversation context. This does not delete messages already sent, documents, contacts, explicit memories or study answers. Remove documents, contacts and memories in their respective sections; saved practice sessions may remain after a document is removed.',
            ],
            [
              'Retention and device access',
              'Local records remain until removed. The application’s SQLite database is not encrypted by APPLE itself; your Mac account, file permissions and disk protection control access. Do not expose the local server to the public internet. This build does not provide an online account, cloud backup or remote deletion service.',
            ],
            [
              'Support and changes',
              'When you email support, the information you choose to send is received by Abhishek Tiwari through email. Avoid sending sensitive content unnecessarily. This policy may change as features change; the update date above identifies this version. For privacy questions or help removing local data, use the contact details below.',
            ],
          ].map(([title, copy], i) => (
            <article className="policy-section" key={title}>
              <span>0{i + 1}</span>
              <div>
                <h2>{title}</h2>
                <p>{copy}</p>
              </div>
            </article>
          ))}
          <a
            className="product-text-link"
            href={`mailto:${EMAIL}?subject=APPLE%20privacy%20question`}
          >
            Contact Abhishek about privacy <ArrowUpRight size={16} />
          </a>
        </section>
      )}
      <ProductFooter navigate={navigate} />
    </div>
  )
}
