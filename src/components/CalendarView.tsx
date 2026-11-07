import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar, {
  CalendarRef,
  DateClickInfo,
  DateSelectInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventDropInfo,
  EventResizeDoneInfo,
} from '@fullcalendar/react'
import themePlugin from '@fullcalendar/react/themes/classic'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import enGb from '@fullcalendar/react/locales/en-gb'
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, ClipboardPaste, Copy, X } from 'lucide-react'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import {
  activeBlock,
  AppData,
  canPlaceBlock,
  contrastText,
  hourString,
  isWithinOneDay,
  Project,
  ViewName,
  visibleHours,
} from '../lib/model'

const VIEW_BUTTONS: { name: ViewName; label: string }[] = [
  { name: 'week1', label: '1 week' },
  { name: 'week2', label: '2 weeks' },
  { name: 'week3', label: '3 weeks' },
  { name: 'month', label: 'Month' },
]

const WEEK_VIEW = {
  type: 'timeGrid',
  dateIncrement: { weeks: 1 },
  dayHeaderFormat: { weekday: 'short', day: 'numeric' },
} as const

const VIEWS = {
  week1: { ...WEEK_VIEW, duration: { weeks: 1 } },
  week2: { ...WEEK_VIEW, duration: { weeks: 2 } },
  week3: { ...WEEK_VIEW, duration: { weeks: 3 }, dayHeaderFormat: { weekday: 'narrow', day: 'numeric' } },
  month: {
    type: 'dayGridMonth',
    dayHeaderFormat: { weekday: 'short' },
    titleFormat: { year: 'numeric', month: 'long' },
    dayMaxEvents: true,
    fixedWeekCount: false,
  },
} as const

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const

interface Props {
  data: AppData
  now: Date
  brush: Project | null
  selectedBlockId: string | null
  onViewChange: (view: ViewName) => void
  onSelectRange: (start: Date, end: Date) => void
  onBlockClick: (blockId: string) => void
  onToggleDone: (blockId: string) => void
  alarmArmed: boolean
  onToggleAlarm: () => void
  onBlockMove: (blockId: string, start: Date, end: Date) => void
  onRejectedChange: (message: string) => void
  /** The Monday of a copied week, waiting to be pasted. */
  copiedWeek: Date | null
  onCopyWeek: (monday: Date) => void
  onPasteWeek: (monday: Date) => void
  onCancelCopy: () => void
}

export default function CalendarView({
  data,
  now,
  brush,
  selectedBlockId,
  onViewChange,
  onSelectRange,
  onBlockClick,
  onToggleDone,
  alarmArmed,
  onToggleAlarm,
  onBlockMove,
  onRejectedChange,
  copiedWeek,
  onCopyWeek,
  onPasteWeek,
  onCancelCopy,
}: Props) {
  const calendar = useRef<CalendarRef>(null)
  const [title, setTitle] = useState('')
  // The Monday of the first week on screen; copy and paste work on that week.
  const [shownMonday, setShownMonday] = useState<Date | null>(null)
  const { view, alarmOn } = data.settings
  const { startHour, endHour } = visibleHours(data)
  const activeId = activeBlock(data.blocks, now)?.id

  const events = useMemo(() => {
    const projects = new Map(data.projects.map((p) => [p.id, p]))
    return data.blocks.flatMap((block) => {
      const project = projects.get(block.projectId)
      if (!project) return []
      const classes = []
      if (block.id === activeId) classes.push('tb-event-now')
      if (block.id === selectedBlockId) classes.push('tb-event-selected')
      if (block.done) classes.push('tb-event-done')
      return [
        {
          id: block.id,
          title: block.title || project.name,
          oneOff: Boolean(project.oneOff),
          done: Boolean(block.done),
          theme: block.title ? project.name : '',
          start: block.start,
          end: block.end,
          color: project.color,
          contrastColor: contrastText(project.color),
          className: classes.join(' '),
        },
      ]
    })
  }, [data.blocks, data.projects, activeId, selectedBlockId])

  // Saved or imported view changes, and clicks on a week in the month view, all land here.
  useEffect(() => {
    const api = calendar.current?.getApi()
    if (api && api.view.type !== view) queueMicrotask(() => api.changeView(view))
  }, [view])

  function handleSelect(info: DateSelectInfo) {
    info.view.calendar.unselect()
    onSelectRange(info.start, info.end)
  }

  function handleDateClick(info: DateClickInfo) {
    // Only the month view has this: clicking anywhere in a week opens that week.
    if (info.view.type !== 'month') return
    info.view.calendar.gotoDate(info.date)
    onViewChange('week1')
  }

  function handleMove(info: EventDropInfo | EventResizeDoneInfo) {
    const { id, start, end } = info.event
    if (!start || !end || !canPlaceBlock(id, start, end, data.blocks)) {
      info.revert()
      onRejectedChange('Blocks must be at least half an hour, in one day, with no overlap.')
      return
    }
    onBlockMove(id, start, end)
  }

  return (
    <main className="tb-main" style={{ '--tb-brush': brush?.color ?? '#94a3b8' } as React.CSSProperties}>
      <header className="tb-toolbar">
        <div className="tb-nav">
          <button className="tb-button" onClick={() => calendar.current?.getApi().today()}>
            Today
          </button>
          <button
            className="tb-icon-button"
            aria-label="Previous"
            onClick={() => calendar.current?.getApi().prev()}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="tb-icon-button"
            aria-label="Next"
            onClick={() => calendar.current?.getApi().next()}
          >
            <ChevronRight size={18} />
          </button>
          <h1 className="tb-title">{title}</h1>
        </div>
        <div className="tb-toolbar-right">
        {view !== 'month' && shownMonday && !copiedWeek && (
          <button
            className="tb-alarm"
            aria-label="Copy week"
            title={view === 'week1' ? 'Copy this week' : 'Copy the first week shown'}
            onClick={() => onCopyWeek(shownMonday)}
          >
            <Copy size={14} />
            <span className="tb-alarm-label">Copy week</span>
          </button>
        )}
        {view !== 'month' && shownMonday && copiedWeek && (
          <span className="tb-paste">
            <button
              className="tb-alarm is-on"
              aria-label="Paste week"
              title={view === 'week1' ? 'Paste into this week' : 'Paste into the first week shown'}
              onClick={() => onPasteWeek(shownMonday)}
            >
              <ClipboardPaste size={14} />
              <span className="tb-alarm-label">Paste week</span>
            </button>
            <button className="tb-icon-button" aria-label="Cancel copy" onClick={onCancelCopy}>
              <X size={14} />
            </button>
          </span>
        )}
        <button
          className={alarmOn ? 'tb-alarm is-on' : 'tb-alarm'}
          aria-pressed={alarmOn}
          aria-label={alarmOn ? 'Alarm on' : 'Alarm off'}
          title={alarmOn ? 'A 10 second sound plays when a block starts or ends' : 'Alarm off'}
          onClick={onToggleAlarm}
        >
          {alarmOn ? <Bell size={14} /> : <BellOff size={14} />}
          <span className={alarmOn && !alarmArmed ? '' : 'tb-alarm-label'}>
            {!alarmOn ? 'Alarm off' : alarmArmed ? 'Alarm on' : 'Click to arm'}
          </span>
        </button>
        <div className="tb-segments" role="group" aria-label="Calendar view">
          {VIEW_BUTTONS.map(({ name, label }) => (
            <button
              key={name}
              className={name === view ? 'tb-segment is-active' : 'tb-segment'}
              aria-pressed={name === view}
              onClick={() => onViewChange(name)}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
      </header>

      <div className="tb-calendar">
        <FullCalendar
          ref={calendar}
          plugins={[themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={enGb}
          firstDay={1}
          headerToolbar={false}
          initialView={view}
          views={VIEWS}
          height="100%"
          expandRows
          titleFormat={{ year: 'numeric', month: 'short', day: 'numeric' }}
          allDaySlot={false}
          nowIndicator
          slotDuration="00:30:00"
          snapDuration="00:30:00"
          slotHeaderInterval="01:00:00"
          slotHeaderFormat={TIME_FORMAT}
          eventTimeFormat={TIME_FORMAT}
          slotMinTime={hourString(startHour)}
          slotMaxTime={hourString(endHour)}
          scrollTime={hourString(Math.max(startHour, Math.min(endHour - 1, now.getHours() - 1)))}
          eventDisplay="block"
          selectable={view !== 'month'}
          editable={view !== 'month'}
          eventResizableFromStart
          selectMirror
          selectOverlap={false}
          selectAllow={(span) => isWithinOneDay(span.start, span.end)}
          eventOverlap={false}
          eventAllow={(span) => isWithinOneDay(span.start, span.end)}
          eventColor={brush?.color}
          eventContrastColor={brush ? contrastText(brush.color) : undefined}
          eventClass="tb-event"
          events={events}
          eventContent={renderEvent}
          dayHeaderContent={(day) =>
            // FullCalendar drops the date from narrow columns, but it's needed to plan ahead.
            day.view.type === 'month' ? day.text : `${day.weekdayText} ${day.dayNumberText}`
          }
          slotLaneClass="tb-slot"
          slotHeaderClass="tb-slot-header"
          moreLinkClick={(info) => {
            info.view.calendar.gotoDate(info.date)
            onViewChange('week1')
          }}
          datesSet={(info) => {
            setTitle(info.view.title)
            setShownMonday(info.view.currentStart)
          }}
          select={handleSelect}
          dateClick={handleDateClick}
          eventClick={(info: EventClickInfo) => {
            const onTick = (info.jsEvent.target as Element).closest('.tb-block-check')
            if (onTick) onToggleDone(info.event.id)
            else onBlockClick(info.event.id)
          }}
          eventDrop={handleMove}
          eventResize={handleMove}
        />
      </div>
    </main>
  )
}

function renderEvent(info: EventDisplayInfo) {
  const { oneOff, done, theme } = info.event.extendedProps
  return (
    <div className="tb-event-body">
      <span className="tb-event-head">
        {oneOff && (
          <span
            className={done ? 'tb-block-check is-done' : 'tb-block-check'}
            role="checkbox"
            aria-checked={done}
            aria-label={`Mark ${info.event.title} as done`}
          >
            {done && <Check size={10} strokeWidth={3.5} />}
          </span>
        )}
        <span className="tb-event-title">{info.event.title}</span>
      </span>
      <span className="tb-event-time">
        {info.timeText}
        {theme ? ` · ${theme}` : ''}
      </span>
    </div>
  )
}
