import React from 'react'
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
            More{' '}
            <span className="marked-word">
              living.
              <svg viewBox="0 0 450 22" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 15 Q170 0 446 10 M18 20 Q210 7 422 17" />
              </svg>
            </span>
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
        <div className="neo-desk" aria-label="Examples of things you can ask APPLE">
          <span className="desk-note">
            A few things to take
            <br />
            off your plate ↴
          </span>
          <div className="desk-window">
            <div className="desk-window-bar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>YOUR EVERYDAY SHORTCUT</b>
              <Command size={15} />
            </div>
            <div className="desk-window-content">
              <div className="desk-greeting">
                <span className="desk-mic">
                  <Mic size={27} strokeWidth={1.7} />
                </span>
                <div>
                  <p>APPLE</p>
                  <h2>What’s on your mind?</h2>
                </div>
              </div>
              <div className="example-card green">
                <MessageCircle size={21} />
                <div>
                  <small>KEEP IN TOUCH</small>
                  <p>“WhatsApp Mum: I’ll be home at 7.”</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <div className="example-card lilac">
                <BookOpen size={21} />
                <div>
                  <small>MAKE IT STICK</small>
                  <p>“Quiz me on these notes.”</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <div className="example-card cream">
                <Monitor size={21} />
                <div>
                  <small>GET TO IT</small>
                  <p>“Open Notes.”</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <div className="desk-bottom">
                <span className="tiny-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>Try these in Assistant</span>
                <span>↵</span>
              </div>
            </div>
          </div>
          <span className="desk-sticker">
            YOUR MAC.
            <br />
            YOUR PACE.
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <path
                d="M15 2v26M2 15h26M6 6l18 18M6 24L24 6"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </span>
        </div>
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
          <article className="neo-feature feature-green">
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
          <article className="neo-feature feature-lilac">
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
          <article className="neo-feature feature-peach">
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
