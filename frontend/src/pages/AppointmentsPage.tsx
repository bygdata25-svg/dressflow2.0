import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  List,
  RotateCcw,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { api } from "../lib/api";
import "../styles/pro-pages.css";
import "./AppointmentsPage.css";

type AppointmentScope = "mine" | "general";
type AppointmentViewMode = "timeline" | "compact" | "day";
type AppointmentDateFilter = "all" | "today" | "week" | "overdue";

type Appointment = {
  id: string;
  title: string;
  description?: string | null;
  appointment_type: string;
  status: string;
  start_at: string;
  end_at?: string | null;
  color?: string | null;
  notes?: string | null;
  customer_id?: string | null;
  dress_id?: string | null;
  customer_name?: string | null;
  dress_name?: string | null;
  dress_code?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  created_by_name?: string | null;
  priority?: string | null;
};

type CustomerOption = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type DressOption = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type CurrentUser = {
  id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

type AppointmentFormState = {
  title: string;
  description: string;
  appointment_type: string;
  status: string;
  start_at: string;
  end_at: string;
  notes: string;
  customer_id: string;
  dress_id: string;
};

const TYPE_CONFIG: Record<string, { color: string; icon: any }> = {
  FITTING: { color: "#e29b8b", icon: Sparkles },
  SHOWROOM: { color: "#9a88a5", icon: CalendarDays },
  DELIVERY: { color: "#8ab9c9", icon: Truck },
  RETURN: { color: "#d5aa68", icon: RotateCcw },
  PRODUCTION: { color: "#b8b0c7", icon: Scissors },
  PRODUCTION_STAGE: { color: "#7c5cff", icon: Scissors },
  TASK: { color: "#c6a75e", icon: CheckCircle2 },
};

const APPOINTMENT_TYPES = [
  "FITTING",
  "SHOWROOM",
  "DELIVERY",
  "RETURN",
  "PRODUCTION",
  "PRODUCTION_STAGE",
  "TASK",
];

const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const emptyForm: AppointmentFormState = {
  title: "",
  description: "",
  appointment_type: "FITTING",
  status: "SCHEDULED",
  start_at: "",
  end_at: "",
  notes: "",
  customer_id: "",
  dress_id: "",
};

function getLocale(language?: string) {
  return String(language || "").toLowerCase().startsWith("en")
    ? "en-US"
    : "es-AR";
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
}

function isThisWeek(value: Date) {
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay() || 7;

  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  return value >= start && value < end;
}

function isFinishedStatus(status?: string | null) {
  const normalized = String(status || "").toUpperCase();
  return ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(normalized);
}

function isAllDayAppointment(appointment: Appointment) {
  return appointment.appointment_type === "PRODUCTION_STAGE";
}

function isOverdue(appointment: Appointment) {
  const startDate = new Date(appointment.start_at);

  if (Number.isNaN(startDate.getTime()) || isFinishedStatus(appointment.status)) {
    return false;
  }

  return startDate < new Date();
}


function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function toDatetimeLocalInputValue(value: Date) {
  const date = new Date(value);
  date.setHours(date.getHours(), date.getMinutes(), 0, 0);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultAppointmentDateTime(value: Date) {
  const date = new Date(value);
  date.setHours(9, 0, 0, 0);
  return toDatetimeLocalInputValue(date);
}

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthCalendarDays(value: Date) {
  const firstDay = new Date(value.getFullYear(), value.getMonth(), 1);
  const start = startOfWeek(firstDay);

  return Array.from({ length: 35 }, (_, index) => addDays(start, index));
}

function getInitials(value?: string | null) {
  const parts = String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "DF";

  return parts.map((part) => part[0]).join("").toUpperCase();
}

export default function AppointmentsPage() {
  const { t, i18n } = useTranslation("appointments");
  const locale = getLocale(i18n.language);

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [dresses, setDresses] = useState<DressOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  const [scope, setScope] = useState<AppointmentScope>("mine");
  const [viewMode, setViewMode] = useState<AppointmentViewMode>("timeline");
  const [dateFilter, setDateFilter] = useState<AppointmentDateFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [currentWeek, setCurrentWeek] = useState(new Date());

  const [form, setForm] = useState<AppointmentFormState>(emptyForm);

  async function loadAppointments() {
    try {
      setLoading(true);
      const response = await api.get<Appointment[]>("/appointments/upcoming", {
        params: {
          scope: "all",
          limit: 50,
        },
      });
      setAppointments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error loading appointments", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await api.get<CurrentUser>("/auth/me");
      setCurrentUser(response.data || null);
    } catch (error) {
      console.error("Error loading current user", error);
      setCurrentUser(null);
    }
  }

  async function loadOptions() {
    try {
      const [customersResponse, dressesResponse] = await Promise.all([
        api.get("/customers"),
        api.get("/dresses"),
      ]);

      const customerRows =
        customersResponse.data?.items || customersResponse.data || [];

      const dressRows =
        dressesResponse.data?.items || dressesResponse.data || [];

      setCustomers(Array.isArray(customerRows) ? customerRows : []);
      setDresses(Array.isArray(dressRows) ? dressRows : []);
    } catch (error) {
      console.error("Error loading appointment options", error);
      setCustomers([]);
      setDresses([]);
    }
  }

  function resetForm() {
    setForm(emptyForm);
  }

  function openCreateModal(prefilledDate?: Date) {
    if (prefilledDate) {
      setForm({
        ...emptyForm,
        start_at: defaultAppointmentDateTime(prefilledDate),
      });
    } else {
      resetForm();
    }

    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  function goToNextWeek() {
    setCurrentWeek((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  }

  function goToPreviousWeek() {
    setCurrentWeek((prev) => {
      const previous = new Date(prev);
      previous.setDate(previous.getDate() - 7);
      return previous;
    });
  }

  function goToToday() {
    setCurrentWeek(new Date());
  }

  function clearFilters() {
    setSearchTerm("");
    setDateFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  async function createAppointment(event: FormEvent) {
    event.preventDefault();

    if (!form.title.trim() || !form.start_at) return;

    try {
      setSaving(true);

      await api.post("/appointments", {
        title: form.title.trim(),
        description: form.description.trim() || null,
        appointment_type: form.appointment_type,
        status: form.status,
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        notes: form.notes.trim() || null,
        customer_id: form.customer_id || null,
        dress_id: form.dress_id || null,
      });

      closeModal();
      resetForm();
      await loadAppointments();
    } catch (error) {
      console.error("Error creating appointment", error);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadCurrentUser();
    void loadAppointments();
    void loadOptions();
  }, []);

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date(value));
  }

  function formatShortDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  }

  function formatHour(value?: string | null) {
    if (!value) return "";

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) return "";

    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsedDate);
  }

  function customerLabel(customer: CustomerOption) {
    const fullName = String(customer.full_name || "").trim();

    if (fullName) return fullName;

    return [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  function dressLabel(dress: DressOption) {
    return [dress.code, dress.name].filter(Boolean).join(" · ");
  }

  function appointmentCustomerName(appointment: Appointment) {
    if (appointment.customer_name) return appointment.customer_name;

    const customer = customers.find(
      (item) => item.id === appointment.customer_id
    );

    return customer ? customerLabel(customer) : "";
  }

  function appointmentDressName(appointment: Appointment) {
    if (appointment.dress_name || appointment.dress_code) {
      return [appointment.dress_code, appointment.dress_name]
        .filter(Boolean)
        .join(" · ");
    }

    const dress = dresses.find((item) => item.id === appointment.dress_id);

    return dress ? dressLabel(dress) : "";
  }

  function appointmentResponsibleName(appointment: Appointment) {
    return (
      appointment.assigned_user_name ||
      appointment.created_by_name ||
      currentUser?.full_name ||
      currentUser?.name ||
      currentUser?.email ||
      ""
    );
  }

  function matchesScope(appointment: Appointment) {
    if (scope === "general") return true;

    if (!currentUser?.id) return true;

    return (
      !appointment.assigned_user_id ||
      appointment.assigned_user_id === currentUser.id
    );
  }

  const filteredAppointments = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return appointments
      .filter(matchesScope)
      .filter((appointment) => {
        if (typeFilter !== "all" && appointment.appointment_type !== typeFilter) {
          return false;
        }

        if (statusFilter !== "all" && appointment.status !== statusFilter) {
          return false;
        }

        const startDate = new Date(appointment.start_at);
        const validDate = !Number.isNaN(startDate.getTime());

        if (dateFilter === "today" && (!validDate || !isSameDay(startDate, new Date()))) {
          return false;
        }

        if (dateFilter === "week" && (!validDate || !isThisWeek(startDate))) {
          return false;
        }

        if (dateFilter === "overdue" && !isOverdue(appointment)) {
          return false;
        }

        if (!normalizedSearch) return true;

        const searchable = normalizeText(
          [
            appointment.title,
            appointment.description,
            appointment.notes,
            appointment.appointment_type,
            appointment.status,
            appointmentCustomerName(appointment),
            appointmentDressName(appointment),
            appointmentResponsibleName(appointment),
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchable.includes(normalizedSearch);
      })
      .sort(
        (left, right) =>
          new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
      );
  }, [
    appointments,
    currentUser,
    customers,
    dateFilter,
    dresses,
    scope,
    searchTerm,
    statusFilter,
    typeFilter,
  ]);

  const stats = useMemo(() => {
    const today = currentWeek;

    return {
      today: appointments.filter((item) => isSameDay(new Date(item.start_at), today))
        .length,
      fittings: appointments.filter((item) => item.appointment_type === "FITTING")
        .length,
      deliveries: appointments.filter(
        (item) => item.appointment_type === "DELIVERY"
      ).length,
      returns: appointments.filter((item) => item.appointment_type === "RETURN")
        .length,
      overdue: appointments.filter(isOverdue).length,
      filtered: filteredAppointments.length,
    };
  }, [appointments, filteredAppointments]);

  const nextAppointment = useMemo(() => {
    return filteredAppointments.find((appointment) => !isFinishedStatus(appointment.status));
  }, [filteredAppointments]);

  const activeFilterCount = useMemo(() => {
    return [
      searchTerm.trim() ? "search" : "",
      dateFilter !== "all" ? dateFilter : "",
      typeFilter !== "all" ? typeFilter : "",
      statusFilter !== "all" ? statusFilter : "",
    ].filter(Boolean).length;
  }, [dateFilter, searchTerm, statusFilter, typeFilter]);

  const today = useMemo(() => new Date(), []);

  const currentWeekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [currentWeek]);

  const selectedDayAppointments = useMemo(() => {
    const selectedKey = dateKey(currentWeek);
    return filteredAppointments.filter(
      (appointment) => dateKey(appointment.start_at) === selectedKey
    );
  }, [currentWeek, filteredAppointments]);

  const selectedDayLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(currentWeek);
  }, [currentWeek, locale]);

  const monthCalendarDays = useMemo(
    () => getMonthCalendarDays(currentWeek),
    [currentWeek]
  );
 
  const weekAppointmentsByDay = useMemo(() => {
    return currentWeekDays.reduce<Record<string, Appointment[]>>((result, day) => {
      const key = dateKey(day);
      result[key] = filteredAppointments.filter(
        (appointment) => dateKey(appointment.start_at) === key
      );
      return result;
    }, {});
  }, [currentWeekDays, filteredAppointments]);

  const weekRangeLabel = useMemo(() => {
    const firstDay = currentWeekDays[0];
    const lastDay = currentWeekDays[currentWeekDays.length - 1];
    const isEnglish = locale.toLowerCase().startsWith("en");
    const sameMonth =
      firstDay.getMonth() === lastDay.getMonth() &&
      firstDay.getFullYear() === lastDay.getFullYear();
    const sameYear = firstDay.getFullYear() === lastDay.getFullYear();

    const startDay = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(firstDay);
    const endDay = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(lastDay);
    const startMonth = new Intl.DateTimeFormat(locale, { month: "short" })
      .format(firstDay)
      .replace(/\.$/, "");
    const endMonth = new Intl.DateTimeFormat(locale, { month: "short" })
      .format(lastDay)
      .replace(/\.$/, "");
    const fullMonth = new Intl.DateTimeFormat(locale, { month: "long" }).format(firstDay);

    if (isEnglish) {
      if (sameMonth) return `${startMonth} ${startDay}–${endDay}`;
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}${sameYear ? "" : `, ${lastDay.getFullYear()}`}`;
    }

    if (sameMonth) return `${startDay}–${endDay} de ${fullMonth}`;
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}${sameYear ? "" : ` ${lastDay.getFullYear()}`}`;
  }, [currentWeekDays, locale]);

  function formatWeekday(value: Date) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(value);
  }

  function formatMonthYear(value: Date) {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(value);
  }

  function renderCalendarEvent(appointment: Appointment) {
    const config = TYPE_CONFIG[appointment.appointment_type] || TYPE_CONFIG.FITTING;
    const customerName = appointmentCustomerName(appointment);
    const dressName = appointmentDressName(appointment);
    const color = appointment.color || config.color;
    const overdue = isOverdue(appointment);
    const allDay = isAllDayAppointment(appointment);
    const referenceMatch =
      appointment.title.match(/\b(?:DEMO-)?OP-\d+\b/i) ||
      dressName.match(/\b(?:DEMO-)?OP-\d+\b/i);
    const orderReference = referenceMatch?.[0] || "";
    const shortOrderReference = orderReference.replace(/^DEMO-/i, "");
    const displayTitle =
      appointment.title
        .replace(/\s*[-·]\s*\b(?:DEMO-)?OP-\d+\b.*$/i, "")
        .trim() || appointment.title;

    return (
      <button
        key={appointment.id}
        type="button"
        className={`appointments__week-event appointments__week-event--${String(appointment.appointment_type || "event").toLowerCase()}${
          overdue ? " appointments__week-event--overdue" : ""
        }`}
        style={{
          borderColor: `${color}33`,
          borderLeftColor: color,
          background: `${color}14`,
          ["--appointment-color" as any]: color,
        }}
        onClick={(event) => {
          event.stopPropagation();
          setSelectedAppointment(appointment);
        }}
      >
        <div className="appointments__week-event-topline">
          <span className="appointments__week-event-time">
            <span style={{ background: color }} />
            <span>{allDay ? t("labels.allDay") : formatHour(appointment.start_at)}</span>
          </span>
        </div>

        <strong className="appointments__week-event-title">{displayTitle}</strong>

        {(customerName || dressName) && !shortOrderReference ? (
          <small>
            {[customerName, dressName].filter(Boolean).join(" · ")}
          </small>
        ) : null}

        <div className="appointments__week-event-foot">
          {shortOrderReference ? (
            <span className="appointments__week-event-ref">{shortOrderReference}</span>
          ) : null}

          <span className={`appointments__week-event-status appointments__week-event-status--${appointment.status.toLowerCase()}`}>
            {t(`statuses.${appointment.status}`, {
              defaultValue: appointment.status,
            })}
          </span>
        </div>
      </button>
    );
  }

  function renderAppointmentCard(appointment: Appointment, compact = false) {
    const config = TYPE_CONFIG[appointment.appointment_type] || TYPE_CONFIG.FITTING;
    const customerName = appointmentCustomerName(appointment);
    const dressName = appointmentDressName(appointment);
    const responsibleName = appointmentResponsibleName(appointment);
    const overdue = isOverdue(appointment);
    const allDay = isAllDayAppointment(appointment);

    return (
      <article
        key={appointment.id}
        className={`appointments__card${compact ? " appointments__card--compact" : ""}${
          overdue ? " appointments__card--overdue" : ""
        }`}
        style={{ borderLeft: `6px solid ${appointment.color || config.color}` }}
      >
        <div className="appointments__card-top">
          <div
            className="appointments__icon"
            style={{
              background: `${appointment.color || config.color}20`,
              color: appointment.color || config.color,
            }}
          >
            <Icon size={18} strokeWidth={2} />
          </div>

          <div className="appointments__meta">
            <span className="appointments__type">
              {t(`types.${appointment.appointment_type}`, {
                defaultValue: appointment.appointment_type,
              })}
            </span>

            <strong>{appointment.title}</strong>
            <small>{formatDate(appointment.start_at)}</small>
          </div>

          {!allDay ? (
            <div className="appointments__hour">
              <Clock3 size={16} strokeWidth={2} />
              <span>{formatHour(appointment.start_at)}</span>
              {appointment.end_at && (
                <small>{`${t("labels.to", { defaultValue: "a" })} ${formatHour(
                  appointment.end_at
                )}`}</small>
              )}
            </div>
          ) : (
            <div className="appointments__hour appointments__hour--all-day">
              <CalendarDays size={16} strokeWidth={2} />
              <span>{t("labels.allDay")}</span>
            </div>
          )}
        </div>

        {!compact && (
          <div className="appointments__body">
            <p>
              {appointment.description
                ? appointment.description
                : t("labels.noDescription")}
            </p>

            {(customerName || dressName) && (
              <div className="appointments__related-line">
                {customerName && (
                  <span>
                    {t("fields.customer")}: <strong>{customerName}</strong>
                  </span>
                )}

                {customerName && dressName && (
                  <span className="appointments__related-dot">•</span>
                )}

                {dressName && (
                  <span>
                    {t("fields.dress")}: <strong>{dressName}</strong>
                  </span>
                )}
              </div>
            )}

            {responsibleName && (
              <div className="appointments__responsible-line">
                <span className="appointments__avatar">{getInitials(responsibleName)}</span>
                <span>
                  {t("fields.responsible", { defaultValue: "Responsable" })}: {" "}
                  <strong>{responsibleName}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="appointments__footer">
          <div className="appointments__badges">
            <span
              className={`appointments__status appointments__status--${appointment.status.toLowerCase()}`}
            >
              {t(`statuses.${appointment.status}`, {
                defaultValue: appointment.status,
              })}
            </span>

            {overdue && (
              <span className="appointments__status appointments__status--overdue">
                <AlertTriangle size={13} strokeWidth={2} />
                {t("statuses.OVERDUE", { defaultValue: "Vencido" })}
              </span>
            )}
          </div>

          <button
            type="button"
            className="appointments__action"
            onClick={() => setSelectedAppointment(appointment)}
          >
            {t("actions.view")}
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      </article>
    );
  }

  if (loading) {
    return (
      <section className="df-pro-page">
        <div className="df-pro-card">{t("states.loading")}</div>
      </section>
    );
  }

  return (
    <section className="df-pro-page appointments appointments--premium appointments--apple">
      <header className="appointments__apple-hero">
        <div>
          <p className="appointments__eyebrow">
            {t("hero.eyebrow", { defaultValue: "DressFlow Premium" })}
          </p>
          <h1 className="appointments__title">{t("title")}</h1>
          <p className="appointments__subtitle">
            {t("hero.subtitle")}
          </p>
        </div>

        <div className="appointments__apple-actions">
          <div className="appointments__scope-switch" role="tablist">
            <button
              type="button"
              className={scope === "mine" ? "is-active" : ""}
              onClick={() => setScope("mine")}
            >
              <UserRound size={15} strokeWidth={2} />
              {t("scope.mine", { defaultValue: "Mi agenda" })}
            </button>

            <button
              type="button"
              className={scope === "general" ? "is-active" : ""}
              onClick={() => setScope("general")}
            >
              <UsersRound size={15} strokeWidth={2} />
              {t("scope.general", { defaultValue: "Agenda general" })}
            </button>
          </div>

          <button
            type="button"
            className="appointments__new-btn"
            onClick={() => openCreateModal()}
          >
            {t("actions.new")}
          </button>
        </div>
      </header>

      <section className="appointments__apple-shell">
        <aside className="appointments__apple-sidebar">
          <div className="appointments__mini-calendar-card">
            <div className="appointments__mini-calendar-head">
              <CalendarDays size={16} strokeWidth={2} />
              <strong>{formatMonthYear(currentWeek)}</strong>
            </div>

            <div className="appointments__mini-calendar-weekdays">
              {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
                (day) => (
                  <span key={day}>
                    {t(`calendar.weekdaysShort.${day}`, {
                      defaultValue: day.slice(0, 1).toUpperCase(),
                    })}
                  </span>
                )
              )}
            </div>

            <div className="appointments__mini-calendar-days">
              {monthCalendarDays.map((day) => {
                const key = dateKey(day);
                const hasEvents = appointments.some(
                  (appointment) => dateKey(appointment.start_at) === key
                );
                const isToday = isSameDay(day, today);
                const isMuted = day.getMonth() !== currentWeek.getMonth();

                return (
                  <button
                    key={key}
                    type="button"
                    className={`${isToday ? "is-today" : ""}${
                      isMuted ? " is-muted" : ""
                    }${hasEvents ? " has-events" : ""}`}
                    onClick={() => {
                      setCurrentWeek(day);
                      setDateFilter("week");
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="appointments__apple-side-card appointments__apple-side-card--next">
            <span>{t("side.nextTitle", { defaultValue: "Próximo evento" })}</span>

            {nextAppointment ? (
              <>
                <strong>{nextAppointment.title}</strong>
                <small>
                  {formatShortDate(nextAppointment.start_at)} · {
                    isAllDayAppointment(nextAppointment)
                      ? t("labels.allDay")
                      : formatHour(nextAppointment.start_at)
                  }
                </small>
              </>
            ) : (
              <>
                <strong>
                  {t("side.noNextTitle", { defaultValue: "Sin próximos eventos" })}
                </strong>
                <small>
                  {t("side.noNextSubtitle", {
                    defaultValue: "No hay pendientes activos.",
                  })}
                </small>
              </>
            )}
          </div>

          <div className="appointments__apple-side-card">
            <span>{t("side.summary", { defaultValue: "Resumen" })}</span>

            <div className="appointments__apple-stats">
              <button
                type="button"
                className={dateFilter === "today" ? "is-active" : ""}
                onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
              >
                <strong>{stats.today}</strong>
                {t("stats.today")}
              </button>

              <button
                type="button"
                className={typeFilter === "FITTING" ? "is-active" : ""}
                onClick={() => setTypeFilter(typeFilter === "FITTING" ? "all" : "FITTING")}
              >
                <strong>{stats.fittings}</strong>
                {t("stats.fittings")}
              </button>

              <button
                type="button"
                className={typeFilter === "DELIVERY" ? "is-active" : ""}
                onClick={() => setTypeFilter(typeFilter === "DELIVERY" ? "all" : "DELIVERY")}
              >
                <strong>{stats.deliveries}</strong>
                {t("stats.deliveries")}
              </button>

              <button
                type="button"
                className={dateFilter === "overdue" ? "is-active is-alert" : "is-alert"}
                onClick={() => setDateFilter(dateFilter === "overdue" ? "all" : "overdue")}
              >
                <strong>{stats.overdue}</strong>
                {t("stats.overdue", { defaultValue: "Vencidos" })}
              </button>
            </div>
          </div>
        </aside>

        <main className={`appointments__apple-main${showFilters ? " has-filters" : " is-compact"}`}>
          <section className="appointments__apple-toolbar">
            <div>
              <p>{t("calendar.week", { defaultValue: "Semana" })}</p>
              <h2 className="appointments__week-range">{weekRangeLabel}</h2>
                 <div className="appointments__week-nav">
                   <button type="button" onClick={goToPreviousWeek}>‹</button>
                   <button type="button" onClick={goToToday}>
                     {t("calendar.today", { defaultValue: "Hoy" })}
                   </button>
                   <button type="button" onClick={goToNextWeek}>›</button>
                 </div>
            </div>

            <div className="appointments__apple-toolbar-actions">
              <div className="appointments__search-box">
                <Search size={16} strokeWidth={2} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t("filters.searchPlaceholder", {
                    defaultValue: "Buscar por cliente, vestido, fitting o responsable...",
                  })}
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm("")}>
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className={`appointments__toolbar-btn${showFilters ? " is-active" : ""}`}
                onClick={() => setShowFilters((value) => !value)}
              >
                <SlidersHorizontal size={16} strokeWidth={2} />
                {t("filters.title", { defaultValue: "Filtros" })}
                {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
              </button>

              <div className="appointments__view-switch">
                <button
                  type="button"
                  className={viewMode === "timeline" ? "is-active" : ""}
                  onClick={() => setViewMode("timeline")}
                  title={t("views.timeline", { defaultValue: "Calendario" })}
                >
                  <LayoutGrid size={16} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  className={viewMode === "day" ? "is-active" : ""}
                  onClick={() => {
                    setCurrentWeek(new Date());
                    setViewMode("day");
                  }}
                  title={t("views.day", { defaultValue: "Hoy" })}
                >
                  <CalendarDays size={16} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  className={viewMode === "compact" ? "is-active" : ""}
                  onClick={() => setViewMode("compact")}
                  title={t("views.compact", { defaultValue: "Lista" })}
                >
                  <List size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </section>

          {showFilters && (
            <section className="appointments__filters-panel appointments__filters-panel--apple">
              <label>
                <span>{t("filters.date", { defaultValue: "Fecha" })}</span>
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value as AppointmentDateFilter)
                  }
                >
                  <option value="all">{t("filters.allDates", { defaultValue: "Todas" })}</option>
                  <option value="today">{t("filters.today", { defaultValue: "Hoy" })}</option>
                  <option value="week">{t("filters.week", { defaultValue: "Esta semana" })}</option>
                  <option value="overdue">{t("filters.overdue", { defaultValue: "Vencidos" })}</option>
                </select>
              </label>

              <label>
                <span>{t("filters.type", { defaultValue: "Tipo" })}</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">{t("filters.allTypes", { defaultValue: "Todos" })}</option>
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`, { defaultValue: type })}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t("filters.status", { defaultValue: "Estado" })}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">{t("filters.allStatuses", { defaultValue: "Todos" })}</option>
                  {APPOINTMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`statuses.${status}`, { defaultValue: status })}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="appointments__clear-btn" onClick={clearFilters}>
                {t("filters.clear", { defaultValue: "Limpiar" })}
              </button>
            </section>
          )}

          {filteredAppointments.length === 0 ? (
            <div className="appointments__empty appointments__empty--apple">
              <CalendarDays size={32} strokeWidth={1.8} />
              <strong>{t("states.emptyTitle")}</strong>
              <span>{t("states.emptySubtitle")}</span>
            </div>
          ) : viewMode === "day" ? (
            <section className="appointments__day-agenda">
              <div className="appointments__day-agenda-head">
                <div>
                  <p>{t("calendar.todayAgenda", { defaultValue: "Agenda del día" })}</p>
                  <h3>{selectedDayLabel}</h3>
                </div>

                <button
                  type="button"
                  className="appointments__day-add-btn"
                  onClick={() => openCreateModal(currentWeek)}
                >
                  {t("actions.addForDay", { defaultValue: "Agregar en este día" })}
                </button>
              </div>

              {selectedDayAppointments.length ? (
                <div className="appointments__day-list">
                  {selectedDayAppointments.map((appointment) =>
                    renderAppointmentCard(appointment, false)
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="appointments__day-empty"
                  onClick={() => openCreateModal(currentWeek)}
                >
                  <CalendarDays size={26} strokeWidth={1.8} />
                  <strong>{t("calendar.noEventsForDay")}</strong>
                  <span>{t("calendar.clickToCreate")}</span>
                </button>
              )}
            </section>
          ) : viewMode === "compact" ? (
            <section className="appointments__apple-list">
              {filteredAppointments.map((appointment) =>
                renderAppointmentCard(appointment, true)
              )}
            </section>
          ) : (
            <section className="appointments__week-grid">
              {currentWeekDays.map((day) => {
                const key = dateKey(day);
                const dayEvents = weekAppointmentsByDay[key] || [];
                const isToday = isSameDay(day, today);

                const visibleEvents = dayEvents.slice(0, 2);
                const hiddenEventsCount = Math.max(0, dayEvents.length - visibleEvents.length);

                return (
                  <article
                    key={key}
                    className={`appointments__week-day${isToday ? " is-today" : ""}`}
                    onClick={() => openCreateModal(day)}
                  >
                    <header className="appointments__week-day-head">
                      <span>{formatWeekday(day)}</span>
                      <strong>{day.getDate()}</strong>
                      <em>{dayEvents.length}</em>
                    </header>

                    <div className="appointments__week-day-events">
                      {dayEvents.length ? (
                        <>
                          {visibleEvents.map(renderCalendarEvent)}

                          {hiddenEventsCount > 0 ? (
                            <button
                              type="button"
                              className="appointments__week-more"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCurrentWeek(day);
                                setViewMode("day");
                              }}
                            >
                              {t("calendar.moreEvents", { count: hiddenEventsCount })}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <div className="appointments__week-empty">
                          <span>{t("calendar.noEvents")}</span>
                          <strong>{t("calendar.createEvent")}</strong>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </main>
      </section>

      {showModal && (
        <div className="appointments__modal-overlay" onClick={closeModal}>
          <form
            className="appointments__modal"
            onSubmit={createAppointment}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="appointments__modal-head">
              <div>
                <span>{t("modal.eyebrow")}</span>
                <h2>{t("modal.title")}</h2>
                <p>{t("modal.subtitle")}</p>
              </div>

              <button
                type="button"
                className="appointments__modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="appointments__form-grid">
              <label>
                <span>{t("fields.title")}</span>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.title")}
                />
              </label>

              <label>
                <span>{t("fields.type")}</span>
                <select
                  value={form.appointment_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      appointment_type: e.target.value,
                    }))
                  }
                >
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`, { defaultValue: type })}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t("fields.customer")}</span>

                <select
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      customer_id: e.target.value,
                    }))
                  }
                >
                  <option value="">{t("placeholders.customer")}</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerLabel(customer) || t("labels.unnamedCustomer")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t("fields.dress")}</span>

                <select
                  value={form.dress_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dress_id: e.target.value,
                    }))
                  }
                >
                  <option value="">{t("placeholders.dress")}</option>

                  {dresses.map((dress) => (
                    <option key={dress.id} value={dress.id}>
                      {dressLabel(dress) || t("labels.unnamedDress")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t("fields.status")}</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                >
                  {APPOINTMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`statuses.${status}`, { defaultValue: status })}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t("fields.startAt")}</span>
                <input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      start_at: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>{t("fields.endAt")}</span>
                <input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      end_at: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="appointments__form-full">
                <span>{t("fields.description")}</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.description")}
                />
              </label>

              <label className="appointments__form-full">
                <span>{t("fields.notes")}</span>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder={t("placeholders.notes")}
                />
              </label>
            </div>

            <div className="appointments__modal-actions">
              <button
                type="button"
                className="appointments__secondary-btn"
                onClick={closeModal}
              >
                {t("actions.cancel")}
              </button>

              <button
                type="submit"
                className="appointments__primary-btn"
                disabled={saving || !form.title.trim() || !form.start_at}
              >
                {saving ? t("actions.saving") : t("actions.create")}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedAppointment && (
        <div
          className="appointments__modal-overlay"
          onClick={() => setSelectedAppointment(null)}
        >
          <div
            className="appointments__modal appointments__modal--detail"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="appointments__modal-head">
              <div>
                <span>{t("modal.detailEyebrow")}</span>

                <h2>{selectedAppointment.title}</h2>

                <p>
                  {t(`types.${selectedAppointment.appointment_type}`, {
                    defaultValue: selectedAppointment.appointment_type,
                  })}
                </p>
              </div>

              <button
                type="button"
                className="appointments__modal-close"
                onClick={() => setSelectedAppointment(null)}
              >
                ×
              </button>
            </div>

            <div className="appointments__detail-grid">
              <div className="appointments__detail-card">
                <span>{t("fields.status")}</span>

                <strong>
                  {t(`statuses.${selectedAppointment.status}`, {
                    defaultValue: selectedAppointment.status,
                  })}
                </strong>
              </div>

              {appointmentCustomerName(selectedAppointment) && (
                <div className="appointments__detail-card">
                  <span>{t("fields.customer")}</span>

                  <strong>{appointmentCustomerName(selectedAppointment)}</strong>
                </div>
              )}

              {appointmentDressName(selectedAppointment) && (
                <div className="appointments__detail-card">
                  <span>{t("fields.dress")}</span>

                  <strong>{appointmentDressName(selectedAppointment)}</strong>
                </div>
              )}

              {appointmentResponsibleName(selectedAppointment) && (
                <div className="appointments__detail-card">
                  <span>{t("fields.responsible", { defaultValue: "Responsable" })}</span>

                  <strong>{appointmentResponsibleName(selectedAppointment)}</strong>
                </div>
              )}

              <div className="appointments__detail-card">
                <span>{t("fields.startAt")}</span>

                <strong>{formatDate(selectedAppointment.start_at)}</strong>

                <small>
                  {isAllDayAppointment(selectedAppointment)
                    ? t("labels.allDay")
                    : formatHour(selectedAppointment.start_at)}
                </small>
              </div>

              {selectedAppointment.end_at && (
                <div className="appointments__detail-card">
                  <span>{t("fields.endAt")}</span>

                  <strong>{formatDate(selectedAppointment.end_at)}</strong>

                  <small>
                    {isAllDayAppointment(selectedAppointment)
                      ? t("labels.allDay")
                      : formatHour(selectedAppointment.end_at)}
                  </small>
                </div>
              )}
            </div>

            <div className="appointments__detail-section">
              <span>{t("fields.description")}</span>

              <p>{selectedAppointment.description || t("labels.noDescription")}</p>
            </div>

            {selectedAppointment.notes && (
              <div className="appointments__detail-section appointments__detail-section--notes">
                <span>{t("fields.notes")}</span>

                <p>{selectedAppointment.notes}</p>
              </div>
            )}

            <div className="appointments__modal-actions">
              <button
                type="button"
                className="appointments__secondary-btn"
                onClick={() => setSelectedAppointment(null)}
              >
                {t("actions.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
