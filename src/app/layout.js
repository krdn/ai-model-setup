import './globals.css';

export const metadata = {
  title: 'AI Provider & Key Management',
  description: 'Secure AI LLM API key setup and manager',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
