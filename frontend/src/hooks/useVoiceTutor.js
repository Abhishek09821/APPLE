import { useEffect, useRef, useState } from 'react'
import { api } from '../utils/api'

export function useVoiceTutor({ speak, cancelSpeech, onStart, onError }) {
  const [lesson, setLesson] = useState(null)
  const current = useRef(null)
  const job = useRef(null)
  const epoch = useRef(0)
  useEffect(
    () => () => {
      epoch.current++
      job.current?.abort()
    },
    [],
  )
  const update = (value) => {
    current.current = value
    setLesson(value)
  }
  function stop() {
    epoch.current++
    job.current?.abort()
    const stopped = cancelSpeech()
    update(null)
    return stopped
  }
  async function ask(value, token) {
    if (epoch.current !== token) return
    update({ ...value, stage: 'question' })
    await speak(`Question ${value.index + 1}. ${value.quiz.questions[value.index].question}`)
    if (epoch.current === token && current.current?.stage === 'question')
      update({ ...current.current, stage: 'answer' })
  }
  async function start(document) {
    stop()
    onStart()
    const token = epoch.current
    job.current = new AbortController()
    update({ document, stage: 'preparing', index: 0 })
    try {
      const quiz = await api(`/documents/${document.id}/quiz`, {
        method: 'POST',
        signal: job.current.signal,
      })
      if (epoch.current !== token) return
      void ask({ document, quiz, index: 0, answers: {}, feedback: null }, token)
    } catch (error) {
      if (epoch.current !== token) return
      update({ document, stage: 'error', error: error.message })
      onError(error.message)
    }
  }
  async function submit(text) {
    const value = current.current
    if (!value?.quiz || !['question', 'answer'].includes(value.stage) || !text.trim()) return
    cancelSpeech()
    if (/^(?:repeat|repeat (?:the )?question|say (?:it|that) again)[.!?]?$/i.test(text.trim())) {
      void ask(value, epoch.current)
      return
    }
    const token = ++epoch.current
    job.current?.abort()
    job.current = new AbortController()
    update({ ...value, stage: 'grading', response: text })
    const question = value.quiz.questions[value.index]
    try {
      const result = await api(`/quizzes/${value.quiz.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ question_id: question.id, answer: text }),
        signal: job.current.signal,
      })
      if (epoch.current !== token) return
      const answers = { ...value.answers, [question.id]: result }
      const next = { ...value, answers, feedback: result, response: text, stage: 'feedback' }
      update(next)
      // Detach feedback from recognition's command promise so the microphone
      // can hear an interruption while the teacher speaks.
      void (async () => {
        await speak(
          result.spoken_feedback ||
            `${result.score === 2 ? 'Correct.' : result.score === 1 ? 'Partly correct.' : 'Not quite.'} ${result.feedback}`,
        )
        if (epoch.current !== token) return
        if (value.index + 1 < value.quiz.questions.length) {
          await ask({ ...next, index: value.index + 1, response: '', feedback: null }, token)
        } else {
          const points = Object.values(answers).reduce((sum, answer) => sum + answer.score, 0)
          update({ ...next, stage: 'complete', points })
          if (!result.completed)
            await speak(
              `Lesson complete. You scored ${points} out of ${value.quiz.questions.length * 2}.`,
            )
        }
      })()
    } catch (error) {
      if (epoch.current !== token) return
      update({ ...value, stage: 'answer', error: error.message })
      onError(error.message)
    }
  }
  function interrupt() {
    const value = current.current
    if (value?.stage === 'feedback') {
      epoch.current++
      update({ ...value, stage: 'paused' })
    }
  }
  function resume() {
    const value = current.current
    if (!value?.quiz) return
    const index = value.stage === 'paused' ? value.index + 1 : value.index
    if (index >= value.quiz.questions.length) {
      const points = Object.values(value.answers).reduce((sum, answer) => sum + answer.score, 0)
      update({ ...value, stage: 'complete', points })
      void speak(`Lesson complete. You scored ${points} out of ${value.quiz.questions.length * 2}.`)
    } else void ask({ ...value, index }, ++epoch.current)
  }
  return { lesson, start, submit, stop, interrupt, resume }
}
