import "./globals.css";

export const metadata = {
  title: "AI Videos",
  description: "Personal AI image and video creator"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
