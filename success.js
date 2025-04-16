import { useRouter } from 'next/router';
import { useContext } from 'react';
import { ThemeContext } from '../style/theme';
import Head from 'next/head';

export default function SuccessPage() {
  const router = useRouter();
  const { subdomain, email } = router.query;
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <>
      <Head>
        <title>Registration Successful - Minecraft Subdomains</title>
      </Head>

      <main className="success-page">
        {/* Success page content */}
        <div className="progress-container">
          <h3>Setup Progress</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '25%' }}></div>
          </div>
          <p className="status-message">Initial request received - processing will begin shortly</p>
        </div>
      </main>

      <button onClick={toggleTheme} className="theme-toggle">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </>
  );
}