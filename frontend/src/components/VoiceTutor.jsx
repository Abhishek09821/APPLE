import React from 'react'
import { BookOpen, Loader2, RotateCcw, X } from 'lucide-react'

export default function VoiceTutor({ tutor, transcript, listening }) {
  const { lesson } = tutor
  if (!lesson) return null
  const question = lesson.quiz?.questions[lesson.index]
  return (
    <section className="voice-tutor" aria-label="Voice lesson">
      <div className="tutor-heading">
        <span>
          <BookOpen size={15} /> VOICE TEACHER
        </span>
        <button aria-label="End lesson" onClick={tutor.stop}>
          <X size={16} />
        </button>
      </div>
      <p className="tutor-document">{lesson.document.name}</p>
      {lesson.quiz?.generation_mode === 'source_review' && (
        <p className="field-hint">
          Quick source review · Complete statements taken directly from your document.
        </p>
      )}
      {lesson.stage === 'preparing' ? (
        <p role="status">
          <Loader2 className="spin" size={16} /> Reading your document and preparing questions…
        </p>
      ) : lesson.stage === 'error' ? (
        <>
          <p role="alert">{lesson.error}</p>
          <button className="secondary-button" onClick={() => tutor.start(lesson.document)}>
            Try lesson again
          </button>
        </>
      ) : lesson.stage === 'complete' ? (
        <>
          <h2>Lesson complete.</h2>
          <p>
            {lesson.points} / {lesson.quiz.questions.length * 2} points
          </p>
          <button className="secondary-button" onClick={() => tutor.start(lesson.document)}>
            Practice again
          </button>
        </>
      ) : (
        <>
          <span className="eyebrow">
            QUESTION {lesson.index + 1} / {lesson.quiz.questions.length} ·{' '}
            {lesson.quiz.citation_label || 'Page'} {question.page}
          </span>
          <h2>{question.question}</h2>
          <p className="tutor-answer">
            {transcript ||
              lesson.response ||
              (listening ? 'Answer aloud. I’m listening.' : 'You can also type your answer below.')}
          </p>
          {lesson.stage === 'grading' && (
            <p role="status">
              <Loader2 size={15} className="spin" /> Checking your answer…
            </p>
          )}
          {lesson.feedback && (
            <div className="tutor-feedback">
              <strong>
                {lesson.feedback.score === 2
                  ? 'Correct'
                  : lesson.feedback.score === 1
                    ? 'Partly correct'
                    : 'Let’s review'}
              </strong>
              <p>{lesson.feedback.feedback}</p>
            </div>
          )}
          {lesson.stage === 'paused' ? (
            <button className="primary-button" onClick={tutor.resume}>
              Continue lesson
            </button>
          ) : (
            <button
              className="subtle-button"
              disabled={lesson.stage === 'grading'}
              onClick={tutor.resume}
            >
              <RotateCcw size={13} /> Repeat question
            </button>
          )}
        </>
      )}
    </section>
  )
}
