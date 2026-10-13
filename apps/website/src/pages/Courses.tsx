import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { useI18n } from '../i18n/context'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { CourseCard } from '../components/CourseShelf'
import { useLadderView } from '../lib/useLadderView'
import { COURSES, type CourseLesson } from '../lib/course.generated'
import { LADDER, type LadderSay } from '../lib/courseLadder.generated'
import { SIGN_IN_ROUTE, STEP, freeLeft, notePromo, startLink } from '../lib/courseLadder'
import './Course.css'

// THE CATALOG (#/courses). Owner, 2026-10-13: the navigation was too hard to follow -- the
// courses sat behind the header's "Pages" disclosure among 28 other links and no page listed
// them. Here is every course of specs/course/courses.t27, each card saying before the press
// what the press will do (yours, free, or club), the count of free courses left, and the one
// lesson to continue. Every word is a spec's: the course specs' and specs/ladder/course-ladder.t27.

type Lang = 'en' | 'ru'
const fmt = (s: string, ...args: (string | number)[]) =>
  args.reduce<string>((out, a, i) => out.split(`{${i}}`).join(String(a)), s)

export default function Courses() {
  const { lang: siteLang } = useI18n()
  const lang: Lang = siteLang === 'ru' ? 'ru' : 'en'
  const say = LADDER.say[lang] as LadderSay
  usePageMeta(say.CATALOG_TITLE, say.CATALOG_LEAD)
  const view = useLadderView(true)
  const { done, opened, valid } = view
  const { search } = useLocation()
  useEffect(() => notePromo(search), [search])
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
          {view.signedIn ? <p className="course-desc">{say.SIGNED_IN}</p> : null}
          {resume && resumeLesson ? (
            <div className="course-hero-actions">
              <Link className="course-btn is-primary" to={`/${resume.route}/${resumeLesson.id}`}>
                {say.CONTINUE}: {resume.say[lang].TITLE} · {resumeLesson[lang].title}
              </Link>
            </div>
          ) : null}
          {!valid.paid ? (
            <p className="course-desc">
              <a className="course-link" href={startLink(STEP.paid, SIGN_IN_ROUTE)} target="_blank" rel="noopener noreferrer">
                {say.SIGN_IN}
              </a>
            </p>
          ) : null}
        </div>
        <ul className="course-catalog">
          {COURSES.map((c) => (
            <CourseCard key={c.id} c={c} lang={lang} view={view} placement="catalog" />
          ))}
        </ul>
      </main>
      <Footer promo={false} />
    </div>
  )
}
