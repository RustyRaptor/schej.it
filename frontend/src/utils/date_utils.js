import { eventTypes, timeTypes } from "@/constants"
import { get } from "./fetch_utils"
import { isBetween } from "./general_utils"
/* 
  Date utils 
*/

/** Returns a string representation of the given date, i.e. May 14th is "5/14" */
export const getDateString = (date, utc = false) => {
  date = new Date(date)
  if (utc) {
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/** Returns an ISO formatted date string */
export const getISODateString = (date, utc = false) => {
  date = new Date(date)
  if (utc) {
    return date.toISOString().substring(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Returns a string representing date range from date1 to date2, i.e. "5/14 - 5/27" */
export const getDateRangeString = (date1, date2, utc = false) => {
  date1 = new Date(date1)
  date2 = new Date(date2)

  // Correct date2 if time is 12am (because ending at 12am doesn't begin the next day)
  if ((utc && date2.getUTCHours() == 0) || (!utc && date2.getHours() == 0)) {
    date2 = getDateDayOffset(date2, -1)
  }

  return getDateString(date1, utc) + " - " + getDateString(date2, utc)
}

/** Returns a string representing the date range for the provided event */
export const getDateRangeStringForEvent = (event) => {
  let timezone = localStorage["timezone"]
  if (timezone) timezone = JSON.parse(timezone)

  if (event.type === eventTypes.DOW || event.type === eventTypes.GROUP) {
    let s = ""

    const dayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for (let date of event.dates) {
      date = getDateWithTimezone(date)

      const abbr = dayAbbreviations[date.getUTCDay()]
      s += abbr + ", "
    }
    s = s.substring(0, s.length - 2)
    return s
  } else if (event.type === eventTypes.SPECIFIC_DATES) {
    const startDate = getDateWithTimezone(new Date(event.dates[0]))
    const endDate = getDateWithTimezone(
      new Date(event.dates[event.dates.length - 1])
    )
    return getDateRangeString(startDate, endDate, true)
  }

  return ""
}

/** Returns a a new date, offset by the timezone in local storage if it exists, offset by local timezone if not */
export const getDateWithTimezone = (date) => {
  date = new Date(date)

  let timezone = localStorage["timezone"]
  if (timezone) timezone = JSON.parse(timezone)

  if (timezone) {
    date.setTime(date.getTime() + timezone.offset * 60 * 1000)
  } else {
    date.setTime(date.getTime() - new Date().getTimezoneOffset() * 60 * 1000)
  }

  return date
}

/** Returns a new date object with the given date (e.g. 5/2/2022) and the specified time (e.g. "11:30") */
export const getDateWithTime = (date, timeString) => {
  date = new Date(date)

  const { hours, minutes } = splitTime(timeString)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes
  )
}

/** Returns a new date object with the given date (e.g. 5/2/2022) and the specified timeNum (e.g. 11.5) */
export const getDateWithTimeNum = (date, timeNum, utc = false) => {
  date = new Date(date)

  const hours = parseInt(timeNum)
  const minutes = (timeNum - hours) * 60
  if (!utc) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes
    )
  } else {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hours,
        minutes
      )
    )
  }
}

/** Returns a date object from the given mongodb objectId */
export const dateFromObjectId = function (objectId) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000)
}

/** Takes a time string (e.g. 13:30) and splits it into hours and minutes, returning an object of the form { hours, minutes } */
export const splitTime = (timeString) => {
  const [hours, minutes] = timeString.split(":")
  return { hours: parseInt(hours), minutes: parseInt(minutes) }
}

/** Takes a timeNum (e.g. 9.5) and splits it into hours and minutes, returning an object of the form { hours, minutes } */
export const splitTimeNum = (timeNum) => {
  const hours = Math.floor(timeNum)
  const minutes = Math.floor((timeNum - hours) * 60)
  return { hours, minutes }
}

/** Returns the specified date offset by the given number of days (can be positive or negative) */
export const getDateDayOffset = (date, offset) => {
  date = new Date(date)
  return new Date(date.getTime() + offset * 24 * 60 * 60 * 1000)
}

/** Returns the specified date offset by the given number of hours */
export const getDateHoursOffset = (date, hoursOffset) => {
  const { hours, minutes } = splitTimeNum(hoursOffset)
  const newDate = new Date(date)
  newDate.setHours(newDate.getHours() + hours)
  newDate.setMinutes(newDate.getMinutes() + minutes)
  return newDate
}

/**
 * Returns a date, transformed to be in the same week of the dows array.
 * `reverse` determines whether to do the opposite calculation (dow date to date)
 */
export const dateToDowDate = (
  dows,
  date,
  weekOffset,
  reverse = false,
  startOnMonday = false
) => {
  // Sort dows to make sure first date is not Saturday when there are multiple dates
  // (as such is the case when an event is created in Tokyo and you're answering in Mountain View)
  // This fixes the dayOffset calculation so that events are displayed in the correct week
  dows = [...dows].sort((date1, date2) => {
    let day1 = new Date(date1).getDay()
    let day2 = new Date(date2).getDay()
    if (startOnMonday) {
      if (day1 === 0) day1 = 7
      if (day2 === 0) day2 = 7
    }
    return day1 - day2
  })

  // Get Sunday of the week containing the dows
  const dowSunday = new Date(dows[0])
  dowSunday.setDate(dowSunday.getDate() - dowSunday.getDay())

  // Get Sunday of the current week offset by weekOffset
  const curSunday = new Date()
  curSunday.setDate(curSunday.getDate() - curSunday.getDay())
  curSunday.setDate(curSunday.getDate() + 7 * weekOffset)
  curSunday.setHours(dowSunday.getHours())
  curSunday.setMinutes(dowSunday.getMinutes())
  curSunday.setSeconds(dowSunday.getSeconds())
  curSunday.setMilliseconds(dowSunday.getMilliseconds())

  // Get the amount of days between both of the sundays
  let dayOffset = Math.round((curSunday - dowSunday) / (1000 * 60 * 60 * 24))

  // Reverse calculation if necessary
  if (reverse) {
    dayOffset *= -1
  }

  // Offset date by the amount of days between the two sundays
  date = new Date(date)
  date.setDate(date.getDate() - dayOffset)

  return date
}

/** Converts a timeNum (e.g. 13) to a timeText (e.g. "1 pm") */
export const timeNumToTimeText = (timeNum, hour12 = true) => {
  const hours = Math.floor(timeNum)
  const minutesDecimal = timeNum - hours
  const minutesString =
    minutesDecimal > 0
      ? `:${String(Math.floor(minutesDecimal * 60)).padStart(2, "0")}`
      : ""

  if (hour12) {
    if (timeNum >= 0 && timeNum < 1) return `12${minutesString} am`
    else if (timeNum < 12) return `${hours}${minutesString} am`
    else if (timeNum >= 12 && timeNum < 13) return `12${minutesString} pm`
    return `${hours - 12}${minutesString} pm`
  }

  return `${hours}:${minutesString.length > 0 ? minutesString : "00"}`
}

/** Converts a timeNum (e.g. 9.5) to a timeString (e.g. 09:30:00) */
export const timeNumToTimeString = (timeNum) => {
  const hours = Math.floor(timeNum)
  const minutesDecimal = timeNum - hours
  const paddedHours = String(hours).padStart(2, "0")
  const paddedMinutes = String(Math.floor(minutesDecimal * 60)).padStart(2, "0")

  return `${paddedHours}:${paddedMinutes}:00`
}

/** Converts a date to a timeNum (e.g. 9.5) */
export const dateToTimeNum = (date, utc = false) => {
  date = new Date(date)
  if (utc) {
    return date.getUTCHours() + date.getUTCMinutes() / 60
  }
  return date.getHours() + date.getMinutes() / 60
}

/** Clamps the date to the given time, type can either be "upper" or "lower" */
export const clampDateToTimeNum = (date, timeNum, type) => {
  const diff = dateToTimeNum(date) - timeNum
  if (type === "upper" && diff < 0) {
    return getDateWithTimeNum(date, timeNum)
  } else if (type === "lower" && diff > 0) {
    return getDateWithTimeNum(date, timeNum)
  }

  // Return original date
  return date
}

/** Returns negative if date1 < date2, positive if date2 > date1, and 0 if date1 == date2 */
export const dateCompare = (date1, date2) => {
  date1 = new Date(date1)
  date2 = new Date(date2)
  return date1.getTime() - date2.getTime()
}

/** Returns whether the given date is between startDate and endDate */
export const isDateBetween = (date, startDate, endDate) => {
  date = new Date(date).getTime()
  startDate = new Date(startDate).getTime()
  endDate = new Date(endDate).getTime()
  return date >= startDate && date <= endDate
}

/** Returns the number of days in the given month */
export const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate()
}

/** returns -1 if a is before b, 1 if a is after b, 0 otherwise */
export const compareDateDay = (a, b) => {
  a = new Date(a)
  b = new Date(b)
  if (a.getFullYear() !== b.getFullYear()) {
    return a.getFullYear() - b.getFullYear()
  } else if (a.getMonth() !== b.getMonth()) {
    return a.getMonth() - b.getMonth()
  } else {
    return a.getDate() - b.getDate()
  }
}

/**
Returns whether the given timeNum is between date1 and date2 
such that date1.getHour() <= timeNum <= date2.getHour(), accounting 
for the possibility that date1 and date2 might be on separate days
*/
export const isTimeNumBetweenDates = (timeNum, date1, date2) => {
  const hour1 = date1.getHours()
  const hour2 = date2.getHours()

  if (hour1 <= hour2) {
    return hour1 <= timeNum && timeNum <= hour2
  } else {
    return (
      (hour1 <= timeNum && timeNum < 24) || (0 <= timeNum && timeNum <= hour2)
    )
  }
}

/** Returns whether date is in between startDate and startDate + duration (in hours) */
export const isDateInRange = (date, startDate, duration) => {
  const endDate = new Date(startDate)
  endDate.setHours(endDate.getHours() + duration)
  return startDate <= date && date <= endDate
}

/** Converts a utc time int to a local time int based on the timezoneOffset */
export const utcTimeToLocalTime = (
  timeNum,
  timezoneOffset = new Date().getTimezoneOffset()
) => {
  let localTimeNum = timeNum - timezoneOffset / 60
  localTimeNum %= 24
  if (localTimeNum < 0) localTimeNum += 24

  return localTimeNum
}

/** Returns a string representing the current timezone */
export const getCurrentTimezone = () => {
  return new Date()
    .toLocaleTimeString("en-us", { timeZoneName: "short" })
    .split(" ")[2]
}

/** Returns the preferred locale of the user
 * Source: https://stackoverflow.com/questions/673905/how-can-i-determine-a-users-locale-within-the-browser
 */
export const getLocale = () => {
  if (navigator.languages != undefined) return navigator.languages[0]
  return navigator.language
}

/** Returns whether the user prefers 12h time */
export const userPrefers12h = () => {
  return Intl.DateTimeFormat(getLocale(), { hour: "numeric" }).resolvedOptions()
    .hour12
}

/** Returns an array of time options based on whether user prefers 12h or 24h */
export const getTimeOptions = () => {
  const prefers12h = !localStorage["timeType"]
    ? userPrefers12h()
    : localStorage["timeType"] === timeTypes.HOUR12

  const times = []
  if (prefers12h) {
    for (let h = 1; h < 12; ++h) {
      times.push({ text: `${h} am`, value: h })
    }
    for (let h = 0; h < 12; ++h) {
      times.push({ text: `${h == 0 ? 12 : h} pm`, value: h + 12 })
    }
    times.push({ text: "12 am", value: 0 })

    return times
  }

  for (let h = 0; h < 24; ++h) {
    times.push({ text: `${h}:00`, value: h })
  }
  return times
}

/** 
  Returns an object of the users' calendar events for each calendar account for the given event, filtering for events
  only between the time ranges of the event and clamping calendar events that extend beyond the time
  ranges
  weekOffset specifies the amount of weeks forward or backward to display events for (only used for weekly schej's)
*/
export const getCalendarEventsMap = async (
  event,
  { weekOffset = 0, eventId = "" }
) => {
  let timeMin, timeMax
  if (event.type === eventTypes.SPECIFIC_DATES) {
    // Get all calendar events between the first date and the last date in dates
    timeMin = new Date(event.dates[0]).toISOString()
    timeMax = getDateDayOffset(
      new Date(event.dates[event.dates.length - 1]),
      2
    ).toISOString()
  } else if (event.type === eventTypes.DOW || event.type === eventTypes.GROUP) {
    // Get all calendar events for the current week offsetted by weekOffset
    const curDateWithWeekOffset = getDateDayOffset(new Date(), weekOffset * 7)
    const curDateDay = curDateWithWeekOffset.getDay()
    timeMin = getDateDayOffset(
      curDateWithWeekOffset,
      -(curDateDay + 1)
    ).toISOString()
    timeMax = getDateDayOffset(timeMin, 7 + 2).toISOString()
  }

  // Fetch calendar events from Google Calendar
  let calendarEventsMap
  if (eventId.length === 0) {
    calendarEventsMap = await get(
      `/user/calendars?timeMin=${timeMin}&timeMax=${timeMax}`
    )
  } else {
    calendarEventsMap = await get(
      `/events/${eventId}/calendar-availabilities?timeMin=${timeMin}&timeMax=${timeMax}`
    )
  }

  return calendarEventsMap
}

/**
  Returns an array of a user's calendar events split by date for a given event
*/
export const splitCalendarEventsByDay = (
  event,
  calendarEvents,
  weekOffset = 0
) => {
  return processCalendarEvents(
    event.dates,
    event.duration,
    calendarEvents,
    event.type,
    weekOffset,
    event.startOnMonday
  )
}

/** Takes an array of calendar events and returns a new array separated by day and with hoursOffset and hoursLength properties */
export const processCalendarEvents = (
  dates,
  duration,
  calendarEvents,
  eventType = eventTypes.SPECIFIC_DATES,
  weekOffset = 0,
  startOnMonday = false
) => {
  // Put calendarEvents into the correct format
  calendarEvents = JSON.parse(JSON.stringify(calendarEvents)) // Make a copy so we don't mutate original array
  calendarEvents = calendarEvents.map((e) => {
    if (eventType === eventTypes.DOW || eventType === eventTypes.GROUP) {
      e.startDate = dateToDowDate(
        dates,
        e.startDate,
        weekOffset,
        false,
        startOnMonday
      )
      e.endDate = dateToDowDate(
        dates,
        e.endDate,
        weekOffset,
        false,
        startOnMonday
      )
    } else {
      e.startDate = new Date(e.startDate)
      e.endDate = new Date(e.endDate)
    }
    return e
  })
  calendarEvents.sort((a, b) => dateCompare(a.startDate, b.startDate))

  // Format array of calendar events by day
  const calendarEventsByDay = []
  for (const i in dates) {
    calendarEventsByDay[i] = []
  }

  // Iterate through all dates and add calendar events to array
  for (const i in dates) {
    if (calendarEvents.length == 0) break

    const start = new Date(dates[i])
    const end = new Date(start)
    end.setHours(start.getHours() + duration)

    // Keep iterating through calendar events until it's empty or there are no more events for the current date
    while (calendarEvents.length > 0 && end > calendarEvents[0].startDate) {
      let [calendarEvent] = calendarEvents.splice(0, 1)

      // Check if calendar event overlaps with event time ranges
      const startDateWithinRange = isBetween(
        calendarEvent.startDate,
        start,
        end
      )
      const endDateWithinRange = isBetween(calendarEvent.endDate, start, end)
      const rangeWithinCalendarEvent =
        isBetween(start, calendarEvent.startDate, calendarEvent.endDate) &&
        isBetween(end, calendarEvent.startDate, calendarEvent.endDate)
      if (
        startDateWithinRange ||
        endDateWithinRange ||
        rangeWithinCalendarEvent
      ) {
        const rangeStartWithinCalendarEvent = isBetween(
          start,
          calendarEvent.startDate,
          calendarEvent.endDate
        )
        const rangeEndWithinCalendarEvent = isBetween(
          end,
          calendarEvent.startDate,
          calendarEvent.endDate
        )
        if (rangeStartWithinCalendarEvent) {
          // Clamp calendarEvent start
          calendarEvent = { ...calendarEvent, startDate: start }
        }
        if (rangeEndWithinCalendarEvent) {
          // Clamp calendarEvent end
          calendarEvent = { ...calendarEvent, endDate: end }
        }

        // The number of hours since start time
        const hoursOffset =
          (calendarEvent.startDate.getTime() - start.getTime()) /
          (1000 * 60 * 60)

        // The length of the event in hours
        const hoursLength =
          (calendarEvent.endDate.getTime() -
            calendarEvent.startDate.getTime()) /
          (1000 * 60 * 60)

        // Don't display event if the event is 0 hours long
        if (hoursLength == 0) continue

        calendarEventsByDay[i].push({
          ...calendarEvent,
          hoursOffset,
          hoursLength,
        })
      }
    }
  }

  return calendarEventsByDay
}

export const getCalendarAccountKey = (email, calendarType) => {
  return `${email}_${calendarType}`
}
