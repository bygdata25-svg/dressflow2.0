import "./AppLoader.css";

type AppLoaderProps = {
  title?: string;
  subtitle?: string;
};

export default function AppLoader({
  title = "DressFlow",
  subtitle = "AI • FASHION • ERP",
}: AppLoaderProps) {
  return (
    <div className="df-loader-page">
      <div className="df-loader-card">
        <img
          src="/logo-full.png"
          alt="DressFlow"
          className="df-loader-logo"
        />

        <div className="df-loader-copy">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="df-loader-bar">
          <span />
        </div>
      </div>
    </div>
  );
}
