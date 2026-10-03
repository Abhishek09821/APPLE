import React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IntelligenceCore } from './VoiceStage'
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  MessageCircle,
  Mic,
  Monitor,
  Command,
  Plus,
} from 'lucide-react'

export default function HomePage({ navigate, onTour, name }) {
  const reduced = useReducedMotion()
  return (
    <>
      <section className="neo-hero">
        <div className="neo-hero-copy">
          <p className="neo-label">
            <span /> A PERSONAL ASSISTANT FOR YOUR MAC
          </p>
          <h1>
            Less clicking.
            <br />
            More <span className="marked-word">living.</span>
          </h1>
          <p className="hero-description">
            Send that message. Find those notes. Talk through something you’re learning. APPLE helps
            with the small jobs that interrupt your day.
          </p>
          <div className="hero-actions">
            <button className="neo-button" onClick={() => navigate('assistant')}>
              {name ? `Let’s go, ${name.split(' ')[0]}` : 'Open APPLE'}
              <ArrowUpRight size={20} />
            </button>
            <button className="neo-text-button" onClick={onTour}>
              Show me around <ArrowRight size={16} />
            </button>
          </div>
          <p className="hero-smallprint">Made for macOS. Runs with a local Ollama model.</p>
        </div>
        <motion.div
          className="system-preview"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          aria-label="APPLE interface preview with example requests"
        >
          <div className="system-preview-bar">
            <span>
              <i /> APPLE / PERSONAL SYSTEM
            </span>
            <span>01</span>
          </div>
          <div className="system-core-stage">
            <span className="system-coordinate">VOICE + ACTION</span>
            <div className="system-reticle" aria-hidden="true" />
            <IntelligenceCore active={false} reduced={reduced} />
            <span className="system-core-caption">One familiar voice. A little more done.</span>
            <span className="system-scan" aria-hidden="true" />
          </div>
          <div className="system-requests">
            <p className="system-requests-label">
              TRY A REQUEST <span>→</span>
            </p>
            {[
              {
                icon: MessageCircle,
                title: '“Tell Mum I’ll be home at 7.”',
                label: 'MESSAGES',
                view: 'settings',
              },
              {
                icon: BookOpen,
                title: '“Quiz me on these notes.”',
                label: 'LIBRARY',
                view: 'library',
              },
              { icon: Monitor, title: '“Open Notes.”', label: 'YOUR MAC', view: 'assistant' },
            ].map(({ icon: Icon, title, label, view }) => (
              <button className="system-request" key={label} onClick={() => navigate(view)}>
                <Icon size={17} strokeWidth={1.5} />
                <span>
                  <small>{label}</small>
                  {title}
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="system-preview-footer">
            <span>DESIGNED AROUND YOU</span>
            <span>macOS</span>
          </div>
        </motion.div>
      </section>
      <div className="neo-strip">
        <span>
          <Mic size={16} /> Talk, or type. Up to you.
        </span>
        <span>
          <BookOpen size={16} /> Learn from your own notes.
        </span>
        <span>
          <Monitor size={16} /> Keep a companion close by.
        </span>
      </div>
      <section className="neo-section">
        <div className="neo-section-title">
          <span className="neo-label">THE USEFUL STUFF</span>
          <h2>
            Small jobs.
            <br />
            One less thing to juggle.
          </h2>
          <p>No new workflow to learn. Start with something you already do every day.</p>
        </div>
        <div className="neo-feature-grid">
          <article className="neo-feature">
            <span className="feature-number">01 / MESSAGES</span>
            <MessageCircle size={32} />
            <h3>
              “Tell Mum
              <br />
              I’m on my way.”
            </h3>
            <p>
              Save her number and the names you call her. APPLE uses your installed WhatsApp app to
              find the chat and send your message.
            </p>
            <button onClick={onTour}>
              See how contacts work <ArrowUpRight size={18} />
            </button>
          </article>
          <article className="neo-feature">
            <span className="feature-number">02 / YOUR NOTES</span>
            <BookOpen size={32} />
            <h3>
              Read it.
              <br />
              Then remember it.
            </h3>
            <p>
              Drop in a document. Ask a question, or let APPLE quiz you out loud, explain your
              answer, and ask the next one.
            </p>
            <button onClick={() => navigate('library')}>
              Open your library <ArrowUpRight size={18} />
            </button>
          </article>
          <article className="neo-feature">
            <span className="feature-number">03 / EVERYDAY TASKS</span>
            <Command size={32} />
            <h3>
              A shorter route
              <br />
              to the next thing.
            </h3>
            <p>
              Open apps, find local files, and run saved routines. APPLE works with accessible Mac
              controls and tells you when it can’t.
            </p>
            <button onClick={() => navigate('assistant')}>
              Try a request <ArrowUpRight size={18} />
            </button>
          </article>
        </div>
      </section>
      <section className="neo-section neo-how">
        <div>
          <span className="neo-label">FIVE MINUTES TO MAKE IT YOURS</span>
          <h2>
            A quick hello.
            <br />
            Then you’re in.
          </h2>
          <button className="neo-button outline" onClick={onTour}>
            Take the quick tour <ArrowRight size={17} />
          </button>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <h3>Tell APPLE your name.</h3>
              <p>
                No account to create. Your name is saved on this Mac and remembered in future
                conversations.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Set up the things you’ll use.</h3>
              <p>
                Choose your local model, save a few WhatsApp contacts, and add a document. The tour
                shows you where everything is.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Start talking.</h3>
              <p>
                Press Start listening and allow the microphone. You can type, stop a request, or
                float the assistant above your other windows.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="neo-about">
        <span className="about-asterisk" aria-hidden="true">
          ✳
        </span>
        <div>
          <span className="neo-label">A NOTE FROM THE BUILDER</span>
          <h2>Hi, I’m Abhishek.</h2>
          <p>
            I’m building APPLE to make the everyday parts of using a computer a bit easier. If
            something feels clumsy, or you have an idea, I’d like to hear it.
          </p>
          <button className="neo-text-button" onClick={() => navigate('contact')}>
            Send me a note <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="plain-promise">
          <Plus size={19} />
          <h3>Know what stays where.</h3>
          <p>
            Your workspace and model run locally. Browser dictation, searches and messages can use
            online services.
          </p>
          <button onClick={() => navigate('privacy')}>
            Read the privacy policy <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </>
  )
}
