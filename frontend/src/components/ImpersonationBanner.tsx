import { exitImpersonation, setToken, type MeResponse } from "../lib/auth";

type Props = {
  me: MeResponse | null;
  onSessionChanged?: () => Promise<void> | void;
};

export default function ImpersonationBanner({
  me,
  onSessionChanged,
}: Props) {
  const handleExit = async () => {
    try {
      const data = await exitImpersonation();
      setToken(data.access_token);

      if (onSessionChanged) {
        await onSessionChanged();
      } else {
        window.location.reload();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al salir de la impersonación";

      alert(message);
    }
  };

  if (!me?.impersonated) return null;

  return (
    <div className="impersonation-banner">
      <div className="impersonation-banner__left">
        <span className="impersonation-banner__badge">IMPERSONANDO</span>
        <span className="impersonation-banner__text">
          Estás navegando como{" "}
          <strong>{me.full_name || `${me.first_name} ${me.last_name}`.trim() || me.email}</strong>
        </span>
      </div>

      <button
        type="button"
        className="impersonation-banner__button"
        onClick={handleExit}
      >
        Salir
      </button>
    </div>
  );
}
