import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { AnimatedBackground } from './AnimatedBackground';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <AnimatedBackground />
      <Navbar />
      <main className="relative z-10 pt-20">
        <Outlet />
      </main>
    </div>
  );
}