import { Link } from 'react-router-dom'
import { COURSES } from '../lib/course.generated'
import { LADDER, type LadderSay } from '../lib/courseLadder.generated'
import { STEP, courseState, promoTo } from '../lib/courseLadder'
import { pickShelf, useLadderView } from '../lib/useLadderView'
import '../pages/Course.css'

// THE COURSE CARDS, wherever a course is sold: the catalog (#/courses), the foot of every course
// page, every blog post (owner, 2026-10-13: other courses at the bottom of each course page and
// adverts across the blog). Each card says before the press what the press will do: yours,
// free, or club. Every word is a spec's: the course specs' and specs/ladder/course-ladder.t27.

type Lang = 'en' | 'ru'
type CourseT = (typeof COURSES)[number]
const fmt = (s: string, ...args: (string | number)[]) =>
  args.reduce<string>((out, a, i) => out.split(`{${i}}`).join(String(a)), s)

export function CourseCard({ c, lang, view, placement }: { c: CourseT; lang: Lang; view: ReturnType<typeof useLadderView>; placement: string }) {
  const say = LADDER.say[lang] as LadderSay
  const s = courseState(c.id, view.opened, view.valid)
  const total = c.lessons.length
  const finished = c.lessons.filter((l) => view.done.includes(l.id)).length
  const badge = s.known && s.open ? say.BADGE_OPEN : view.valid.paid || s.step !== STEP.paid ? say.BADGE_FREE : say.BADGE_CLUB
  const cls = s.known && s.open ? 'is-open' : badge === say.BADGE_CLUB ? 'is-club' : 'is-free'
  return (
    <li className={`course-card ${cls}`}>
      <Link to={promoTo(c.route, placement)} className="course-card-link">
        <span className="course-badge">{badge}</span>
        <span className="course-card-title">{c.say[lang].TITLE}</span>
        <span className="course-card-desc">{c.say[lang].DESCRIPTION}</span>
        <span className="course-card-foot">{finished > 0 ? fmt(say.DONE_OF, finished, total) : fmt(say.LESSONS, total)}</span>
        {finished > 0 ? (
          <span className="course-card-bar" aria-hidden="true">
            <span style={{ width: `${(100 * finished) / total}%` }} />
          </span>
        ) : null}
      </Link>
    </li>
  )
}

export default function CourseShelf({ lang, placement, exclude, limit = 3, title }: { lang: Lang; placement: string; exclude?: string; limit?: number; title?: string }) {
  const say = LADDER.say[lang] as LadderSay
  const view = useLadderView()
  const picks = pickShelf(exclude, view.opened, limit)
  if (!picks.length) return null
  return (
    <section className="course-shelf" aria-label={title ?? say.MORE_TITLE}>
      <div className="course-shelf-head">
        <h2 className="course-shelf-title">{title ?? say.MORE_TITLE}</h2>
        <Link className="course-link" to={promoTo('courses', placement)}>
          {say.COURSES} →
        </Link>
      </div>
      <ul className="course-catalog">
        {picks.map((c) => (
          <CourseCard key={c.id} c={c} lang={lang} view={view} placement={placement} />
        ))}
      </ul>
    </section>
  )
}
