import { useState, useContext } from 'react';
import { ThemeContext } from '../style/theme';
import Head from 'next/head';
import axios from 'axios';

export default function Home() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    serverIp: ''
  });
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    try {
      const response = await axios.post('/api/register', formData);
      window.location.href = `/success?subdomain=${formData.username}.minecraft-sub.com&email=${formData.email}`;
    } catch (error) {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        setErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Minecraft Subdomains - Free Custom Server Address</title>
        <link href="https://fonts.googleapis.com/css2?family=Minecraft&family=Roboto:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      <header className="site-header">
        {/* Header content same as before */}
      </header>

      <main>
        {/* All your page sections */}
        <section id="register" className="registration-section">
          <form onSubmit={handleSubmit} className="registration-form">
            {/* Form fields */}
            <button type="submit" disabled={isSubmitting} className="submit-btn">
              {isSubmitting ? 'Processing...' : 'Register Subdomain'}
            </button>
          </form>
          {errors.length > 0 && (
            <div className="error-message">
              <h3>Please fix these errors:</h3>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <button onClick={toggleTheme} className="theme-toggle">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <footer className="site-footer">
        {/* Footer content */}
      </footer>
    </>
  );
}