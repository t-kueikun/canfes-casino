"use client";

// components/BottomNavigationBar/BottomNavigationBar.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './BottomNavigationBar.module.css';
import { usePathname } from 'next/navigation';

type BottomNavigationBarProps = {
  className?: string;
  variant?: 'default' | 'liquid';
};

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ className, variant = 'default' }) => {
  const pathname = usePathname();
  const isPayment = pathname?.startsWith('/dashboard/payment');
  const isAccount = pathname?.startsWith('/dashboard/account');
  const isDashboard = pathname?.startsWith('/dashboard') && !isPayment; // dashboard but not payment

  const extraClasses = new Set<string>();
  if (className) {
    className
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => extraClasses.add(token));
  }
  if (variant === 'liquid' || extraClasses.has('liquid')) {
    extraClasses.add(styles.navContainerLiquid);
    extraClasses.delete('liquid');
  }

  const containerClassName = [styles.navContainer, ...extraClasses].join(' ').trim();

  return (
    <div className={containerClassName}>
      {/* 中央のフローティングアクションボタン (FAB) */}
      <Link href="/dashboard/scan" className={`${styles.fab} ${isPayment || pathname === '/dashboard/scan' ? styles.fabActive : ''}`}>
        <Image
          src="/icons/QR Code Scanner Icon.svg"
          alt="QRコードをスキャン"
          width={28}
          height={28}
          className={styles.fabIcon}
        />
        <span className={styles.fabText}>スキャン</span>
      </Link>

      {/* ナビゲーションバー本体 */}
      <nav className={styles.navBar}>
        {/* 左側のアイテム: ホーム */}
        <Link href="/dashboard" className={`${styles.navItem} ${isDashboard ? styles.activeNavItem : ''}`}>
          <Image src="/icons/Home Icon.svg" alt="ホーム" width={28} height={28} className={`${styles.navIcon} ${isDashboard ? styles.activeIcon : ''}`} />
          <span>ホーム</span>
        </Link>

        {/* 中央ボタンのスペースを確保するためのスペーサー */}
        <div className={styles.spacer}></div>

        {/* 右側のアイテム: アカウント */}
        <Link href="/dashboard/account" className={`${styles.navItem} ${isAccount ? styles.activeNavItem : ''}`}>
          <Image src="/icons/nav-user.svg" alt="アカウント" width={28} height={28} className={`${styles.navIcon} ${isAccount ? styles.activeIcon : ''}`} />
          <span>アカウント</span>
        </Link>
      </nav>
    </div>
  );
};

export default BottomNavigationBar;
