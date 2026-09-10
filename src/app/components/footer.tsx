"use client";

import Link from 'next/link';
import Image from 'next/image';
import styles from './footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      
      {/* コピーライト部分 */}
      <small className={styles.copyright}>
        © 2025 爆裂カジノ / キャンパスフェスティバル横浜キャンパス
      </small>
            {/* リンク部分 */}
      <div className={styles.navLinks}>
        <Link href="mailto:staff@canfes.example">お問い合わせ</Link>
      </div>
    </footer>
  );
};

export default Footer;
