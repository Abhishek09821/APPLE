import React from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api } from '../utils/api'
import { IconButton, Empty } from './ui'

export default function LibraryView({
  quiz,
  setQuiz,
  questionIndex,
  setQuestionIndex,
  answer,
  setAnswer,
  grade,
  setGrade,
  working,
  doWork,
  fileInput,
  upload,
  filePath,
  setFilePath,
  refresh,
  setNotice,
  documents,
  librarySearch,
  setLibrarySearch,
  setSelectedDoc,
  setView,
  setInput,
  startQuiz,
  selectedDoc,
  startVoiceLesson,
  afterImport,
}) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span className="eyebrow">KNOWLEDGE THAT STAYS WITH YOU</span>
        <h1>
          Your second brain<span>.</span>
        </h1>
        <p>Add your reading. Ask better questions. Make it stick.</p>
      </div>
      {quiz ? (
        <div className="quiz-panel">
          <div className="quiz-top">
            <span className="tag purple">PRACTICE SESSION</span>
            <button className="subtle-button" onClick={() => setQuiz(null)}>
              <X size={15} />
              Close
            </button>
          </div>
          <h3>{quiz.name}</h3>
          <div className="quiz-progress">
            {quiz.questions.map((q, i) => (
              <span key={q.id} className={i <= questionIndex ? 'filled' : ''} />
            ))}
          </div>
          <span className="eyebrow">
            QUESTION {questionIndex + 1} OF {quiz.questions.length} ·{' '}
            {quiz.citation_label || 'Page'} {quiz.questions[questionIndex].page}
          </span>
          <h2>{quiz.questions[questionIndex].question}</h2>
          <textarea
            aria-label="Your practice answer"
            placeholder="Explain it in your own words…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!grade}
          />
          {grade ? (
            <div className="grade">
              <strong>
                {grade.score === 2
                  ? 'You’ve got it.'
                  : grade.score === 1
                    ? 'You’re getting there.'
                    : 'Let’s build on this.'}{' '}
                <span>{grade.score}/2 points</span>
              </strong>
              <p>{grade.feedback}</p>
              <details>
                <summary>See reference answer</summary>
                <p>{grade.reference}</p>
              </details>
              {questionIndex < quiz.questions.length - 1 ? (
                <button
                  className="primary-button"
                  onClick={() => {
                    setQuestionIndex((i) => i + 1)
                    setAnswer('')
                    setGrade(null)
                  }}
                >
                  Next question
                  <ArrowUpRight size={15} />
                </button>
              ) : (
                <div className="quiz-finish">
                  <strong>
                    Session complete ·{' '}
                    {Object.values(quiz.answers).reduce((sum, a) => sum + a.score, 0)} /{' '}
                    {quiz.questions.length * 2} points
                  </strong>
                  <button className="primary-button" onClick={() => setQuiz(null)}>
                    Back to library
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="primary-button"
              disabled={!answer.trim() || working}
              onClick={() =>
                doWork(async () => {
                  const q = quiz.questions[questionIndex]
                  const result = await api(`/quizzes/${quiz.id}/answer`, {
                    method: 'POST',
                    body: JSON.stringify({ question_id: q.id, answer }),
                  })
                  setGrade(result)
                  setQuiz((prev) => ({
                    ...prev,
                    answers: { ...prev.answers, [q.id]: result },
                  }))
                })
              }
            >
              {working ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
              Check my answer
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            className="upload-zone"
            disabled={working}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (!working) upload(e.dataTransfer.files[0])
            }}
          >
            <span className="upload-icon">
              {working ? <Loader2 className="spin" size={25} /> : <Upload size={25} />}
            </span>
            <strong>
              {working ? 'Working with your document…' : 'Drop a little knowledge here'}
            </strong>
            <span>Choose a file or drag it in · PDF, DOCX, TXT, MD · up to 20 MB</span>
            <span className="upload-link">
              Browse files <ArrowUpRight size={13} />
            </span>
          </button>
          <form
            className="path-import"
            onSubmit={(e) => {
              e.preventDefault()
              doWork(async () => {
                const document = await api('/documents/import', {
                  method: 'POST',
                  body: JSON.stringify({ path: filePath }),
                })
                setFilePath('')
                await afterImport(document)
              })
            }}
          >
            <FolderOpen size={16} />
            <input
              aria-label="Local document path"
              placeholder="Or paste a local path: ~/Documents/notes.pdf"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
            <button disabled={!filePath.trim() || working}>Import</button>
          </form>
          <div className="list-heading">
            <h3>
              Your library <span>{documents.length}</span>
            </h3>
            <div className="search-field">
              <Search size={14} />
              <input
                aria-label="Search library"
                placeholder="Find a document"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
              />
            </div>
          </div>
          {documents.length ? (
            <div className="document-list">
              {documents
                .filter((d) => d.name.toLowerCase().includes(librarySearch.toLowerCase()))
                .map((doc) => (
                  <div className="document-row" key={doc.id}>
                    <span className="document-icon">
                      <FileText size={22} />
                    </span>
                    <div className="document-info">
                      <strong>{doc.name}</strong>
                      <span>
                        {doc.pages} {doc.pages === 1 ? 'page' : 'pages'} ·{' '}
                        {(doc.characters / 1000).toFixed(1)}k characters · stored locally
                      </span>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSelectedDoc(doc)
                        setView('assistant')
                        setInput('Summarize the key ideas in this document.')
                      }}
                    >
                      Ask
                      <ArrowUpRight size={13} />
                    </button>
                    <button
                      className="secondary-button"
                      disabled={working}
                      onClick={() => startVoiceLesson(doc)}
                    >
                      Teach me aloud
                    </button>
                    <button
                      className="primary-button"
                      disabled={working}
                      onClick={() => startQuiz(doc)}
                    >
                      Quiz me
                    </button>
                    <IconButton
                      label={`Remove ${doc.name} from library`}
                      disabled={working}
                      onClick={() =>
                        doWork(async () => {
                          await api(`/documents/${doc.id}`, {
                            method: 'DELETE',
                          })
                          if (selectedDoc?.id === doc.id) setSelectedDoc(null)
                          await refresh()
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                ))}
            </div>
          ) : (
            <Empty icon={BookOpen} title="Room for your next big idea">
              Your imported documents will appear here. The original files stay untouched.
            </Empty>
          )}
          <div className="info-note">
            <ShieldCheck size={16} />
            <p>
              Documents are indexed locally for questions and practice. This adds reference
              knowledge; it doesn’t retrain the model. Scanned PDFs need OCR first.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
