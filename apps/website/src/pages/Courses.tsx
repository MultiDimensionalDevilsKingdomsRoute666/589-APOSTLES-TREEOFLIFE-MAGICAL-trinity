import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { useI18n } from '../i18n/context'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { COURSE, COURSES, type CourseLesson } from '../lib/course.generated'
import { LADDER, type LadderSay } from '../lib/courseLadder.generated'
import { STEP, checkKey, courseState, freeLeft, readKeys, readOpened } from '../lib/courseLadder'
import './Course.css'

// THE CATALOG (#/courses). Owner, 2026-10-13: the navigation was too hard to follow -- the
// courses sat behind the header's "Pages" disclosure among 28 other links and no page listed
// them. Here is every course of specs/course/courses.t27, each card saying before the press
// what the press will do (yours, free, or club), the count of free courses left, and the one
// lesson to continue. Every word is a spec's: the course specs' and specs/ladder/course-ladder.t27.

type Lang = 'en' | 'ru'
const fmt = (s: string, ...args: (string | number)[]) =>
  args.reduce<string>((out, a, i) => out.split(`{${i}}`).join(String(a)), s)

function readDone(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(COURSE.progressKey) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export default function Courses() {
  const { lang: siteLang } = useI18n()
  const lang: Lang = siteLang === 'ru' ? 'ru' : 'en'
  const say = LADDER.say[lang] as LadderSay
  usePageMeta(say.CATALOG_TITLE, say.CATALOG_LEAD)
  const done = useMemo(() => (typeof window === 'undefined' ? [] : readDone()), [])
  const known = useMemo(() => COURSES.map((c) => c.id as string), [])
  const withProgress = useMemo(() => COURSES.filter((c) => c.lessons.some((l) => done.includes(l.id))).map((c) => c.id as string), [done])
  const opened = useMemo(() => (typeof window === 'undefined' ? [] : readOpened(known, withProgress)), [known, withProgress])
  const [valid, setValid] = useState({ bot: false, paid: false })

  useEffect(() => {
    let live = true
    const held = readKeys()
    void Promise.all([held.bot ? checkKey(held.bot) : { ok: false }, held.paid ? checkKey(held.paid) : { ok: false }]).then(([b, p]) => {
      if (live) setValid({ bot: Boolean(b.ok), paid: Boolean(p.ok) })
    })
    return () => {
      live = false
    }
  }, [])

  const left = freeLeft(opened)
  // The course to continue: the latest one opened that still has a lesson to do.
  const resume = [...opened]
    .reverse()
    .map((o) => COURSES.find((c) => c.id === o.id))
    .find((c) => c && c.lessons.some((l) => !done.includes(l.id)))
  const resumeLesson = resume ? (resume.lessons as readonly CourseLesson[]).find((l) => !done.includes(l.id)) : undefined

  return (
    <div className="course-page">
      <Navigation />
      <main className="course-main">
        <div className="course-hero">
          <h1 className="course-title">{say.CATALOG_TITLE}</h1>
          <p className="course-lead">{say.CATALOG_LEAD}</p>
          <p className="course-counter" aria-live="polite">
            {valid.paid ? say.IN_CLUB : left > 0 ? fmt(say.FREE_LEFT, left) : say.FREE_NONE}
          </p>
          {resume && resumeLesson ? (
            <div className="course-hero-actions">
              <Link className="course-btn is-primary" to={`/${resume.route}/${resumeLesson.id}`}>
                {say.CONTINUE}: {resume.say[lang].TITLE} · {resumeLesson[lang].title}
              </Link>
            </div>
          ) : null}
        </div>
        <ul className="course-catalog">
          {COURSES.map((c) => {
            const s = courseState(c.id, opened, valid)
            const total = c.lessons.length
            const finished = c.lessons.filter((l) => done.includes(l.id)).length
            const badge = s.known && s.open ? say.BADGE_OPEN : valid.paid || s.step !== STEP.paid ? say.BADGE_FREE : say.BADGE_CLUB
            const cls = s.known && s.open ? 'is-open' : badge === say.BADGE_CLUB ? 'is-club' : 'is-free'
            return (
              <li key={c.id} className={`course-card ${cls}`}>
                <Link to={`/${c.route}`} className="course-card-link">
                  <span className="course-badge">{badge}</span>
                  <span className="course-card-title">{c.say[lang].TITLE}</span>
                  <span className="course-card-desc">{c.say[lang].DESCRIPTION}</span>
                  <span className="course-card-foot">
                    {finished > 0 ? fmt(say.DONE_OF, finished, total) : fmt(say.LESSONS, total)}
                  </span>
                  {finished > 0 ? (
                    <span className="course-card-bar" aria-hidden="true">
                      <span style={{ width: `${(100 * finished) / total}%` }} />
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
