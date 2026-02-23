'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GridScan from '@/components/ui/GridScan';
import TrueFocus from '@/components/ui/TrueFocus';
import './waitlist.css';

const steps = [
    {
        id: "01",
        title: "BlockDAG Performance",
        desc: "Kaspa-speed precision with the security of Proof-of-Work. Kasnomo connects your wallet to a high-frequency house balance for instant execution on the world's fastest DAG."
    },
    {
        id: "02",
        title: "Multi-Asset Feed",
        desc: "Trade more than just crypto. Predict millisecond movements on Bitcoin, Kaspa, Gold, and Tech giants like NVDA and TSLA via Pyth Fixed Oracles."
    },
    {
        id: "03",
        title: "Blitz Protocol",
        desc: "Activate high-frequency Blitz Rounds. Experience amplified multipliers up to 10x and 30-second settlement windows for maximum capital efficiency."
    },
    {
        id: "04",
        title: "Tiered Autonomy",
        desc: "Climb from Standard to VIP. Unlock exclusive indicators, lower fee brackets, and priority treasury withdrawals as an early decentralized trader."
    }
];

const testimonials = [
    {
        name: "Astra Vance",
        role: "Venture Strategist",
        content: "The Blitz Rounds are a game-changer. The millisecond precision from Kaspa's BlockDAG makes Kasnomo feel like a professional CEX but with decentralized peace of mind.",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Lyra Sterling",
        role: "DeFi Architect",
        content: "The 30-second round intervals are perfect for scalping. Knowing every outcome is verifiable on-chain gives me the confidence to trade larger volumes.",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Kai Zen",
        role: "Algo Developer",
        content: "Migrating to the Kasnomo protocol was the best move. Instant house balance settlement solves the on-chain latency issue perfectly for high-frequency binary options on Kaspa.",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Julian Vane",
        role: "Quant Trader",
        content: "Kasnomo's tiered system provides a clear roadmap for traders. The VIP perks and advanced indicators give us a significant edge in these fast-moving rounds.",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop"
    },
    {
        name: "Sarah M.",
        role: "Early Adopter",
        content: "Switching between Bitcoin and Gold predictions within seconds is what makes Kasnomo stand out. The multi-asset support is truly elite.",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop"
    }
];

const faqs = [
    {
        question: "How does the House Balance work?",
        answer: "To ensure millisecond execution, Kasnomo uses a hybrid house balance system. You deposit KAS into a non-custodial treasury, which is then reflected in your game balance for instant off-chain betting."
    },
    {
        question: "What assets can I trade?",
        answer: "Kasnomo supports a wide range of assets including major cryptos (BTC, ETH, KAS), precious metals (Gold, Silver), and top-tier stocks (AAPL, NVDA, TSLA) through Pyth price feeds."
    },
    {
        question: "What are Blitz Rounds?",
        answer: "Blitz Rounds are premium high-frequency trading sessions. They offer significantly higher multipliers (up to 10x) and ultra-fast 30-second round intervals for advanced traders."
    },
    {
        question: "How do I upgrade to VIP tier?",
        answer: "Tiers (Standard, Gold, VIP) are determined by your trading volume and early participation. VIPs enjoy exclusive technical indicators, reduced withdrawal fees, and priority treasury access."
    },
    {
        question: "Are my funds safe?",
        answer: "Yes. All deposits are held in a secure treasury wallet verified on-chain. Withdrawals are processed through the Kasnomo protocol, ensuring you maintain ultimate control over your assets."
    }
];

export default function WaitlistPage() {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);

        const interval = setInterval(() => {
            setActiveIdx(prev => (prev + 1) % testimonials.length);
        }, 5000);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(interval);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setIsSubmitted(true);
        } catch (error) {
            console.error('Waitlist submission error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isExpanded = isHovered || email.length > 0;

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <main className="landing-layout selection:bg-purple-500/30">
            {/* Background stays fixed */}
            <div className="fixed inset-0 pointer-events-none">
                <GridScan
                    sensitivity={0.01}
                    lineThickness={1}
                    linesColor="#14141a"
                    gridScale={0.1}
                    scanColor="#FF9FFC"
                    scanOpacity={0.03}
                    scanDuration={16.0}
                    enablePost
                    bloomIntensity={0.05}
                    chromaticAberration={0.0001}
                    noiseIntensity={0.01}
                />
            </div>

            <nav className={`sticky-nav ${scrolled ? 'scrolled' : 'at-top'}`}>
                <div className="text-xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-orbitron)' }}>KASNOMO</div>
                <div className="flex items-center gap-4">
                    <a href="/" className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white hover:text-black transition-all">Launch App</a>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section id="hero-top" className="min-h-screen justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center z-10 max-w-4xl"
                >
                    <div className="mb-10">
                        <TrueFocus
                            sentence="Kasnomo | The future is decentralized."
                            separator=" | "
                            manualMode={false}
                            blurAmount={12}
                            borderColor="#FF9FFC"
                            glowColor="rgba(255, 159, 252, 0.4)"
                            animationDuration={2.0}
                            pauseBetweenAnimations={3.0}
                        />
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="text-white/40 text-xl font-medium mb-16 max-w-2xl mx-auto leading-relaxed"
                    >
                        Secure your spot in the next evolution of binary options trading. Early access members get lifetime zero-fee trading and exclusive perks.
                    </motion.p>

                    <div className="waitlist-form-container mx-auto">
                        {!isSubmitted ? (
                            <motion.form
                                onSubmit={handleSubmit}
                                className="waitlist-form"
                            >
                                <div
                                    className={`input-container mx-auto ${isExpanded ? 'expanded' : ''}`}
                                    onMouseEnter={() => setIsHovered(true)}
                                    onMouseLeave={() => setIsHovered(false)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div
                                                    key="input-field"
                                                    initial={{ width: 0, opacity: 0 }}
                                                    animate={{ width: 260, opacity: 1 }}
                                                    exit={{ width: 0, opacity: 0 }}
                                                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <input
                                                        type="email"
                                                        placeholder="your@email.com"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        required
                                                        className="waitlist-input"
                                                        autoFocus
                                                    />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <motion.button
                                            layout
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="mini-submit text-nowrap"
                                            style={{ marginLeft: 'auto', flexShrink: 0 }}
                                        >
                                            {isSubmitting ? '...' : 'Join'}
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.form>
                        ) : (
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-12 rounded-[40px] border border-purple-500/30 bg-purple-500/5 backdrop-blur-xl">
                                <div className="text-5xl mb-6">✨</div>
                                <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">You're in the elite!</h3>
                                <p className="text-white/40 text-lg font-medium">An invitation will be sent to your inbox shortly. Welcome to the future of trading.</p>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </section>

            {/* HOW IT WORKS SECTION - Game Mechanics */}
            <section className="bg-white/[0.01]">
                <div className="section-content">
                    <div className="text-center mb-32">
                        <div className="text-purple-500 font-black uppercase tracking-[0.4em] text-xs mb-6">Execution Protocol</div>
                        <h2 className="text-6xl font-black tracking-tighter mb-8 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">How Kasnomo Works</h2>
                        <div className="h-0.5 w-16 bg-purple-500/30 mx-auto rounded-full" />
                    </div>

                    <div className="mechanics-grid">
                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.15, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                className="mechanic-card group"
                            >
                                <div className="mechanic-info">
                                    <div className="mechanic-number">{step.id}</div>
                                    <h3 className="mechanic-title group-hover:text-purple-400 transition-colors">
                                        {step.title}
                                    </h3>
                                    <p className="mechanic-desc">
                                        {step.desc}
                                    </p>
                                </div>

                                <div className="mechanic-visual">
                                    <div className="abstract-shape">
                                        <div className="abstract-inner" style={{
                                            animationDelay: `${i * 0.8}s`,
                                            borderRadius:
                                                i === 0 ? '30% 70% 70% 30% / 30% 30% 70% 70%' :
                                                    i === 1 ? '50% 50% 50% 50% / 20% 20% 80% 80%' :
                                                        i === 2 ? '70% 30% 30% 70% / 60% 40% 60% 40%' :
                                                            '40% 60% 40% 60% / 10% 90% 10% 90%',
                                            transform: `rotate(${i * 45}deg)`,
                                            background:
                                                i === 0 ? 'linear-gradient(135deg, rgba(255, 159, 252, 0.4), rgba(168, 85, 247, 0.1))' :
                                                    i === 1 ? 'linear-gradient(45deg, rgba(255, 107, 107, 0.3), rgba(255, 159, 252, 0.1))' :
                                                        i === 2 ? 'linear-gradient(225deg, rgba(72, 219, 251, 0.3), rgba(168, 85, 247, 0.1))' :
                                                            'linear-gradient(315deg, rgba(29, 209, 161, 0.3), rgba(168, 85, 247, 0.1))'
                                        }} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS SECTION */}
            <section>
                <div className="section-content">
                    <div className="text-center mb-24">
                        <h2 className="text-5xl font-black tracking-tighter mb-6">Trusted by Traders</h2>
                        <p className="text-white/40 text-lg font-medium">Join the next generation of binary options enthusiasts.</p>
                    </div>
                </div>

                <div className="testimonials-slider-container">
                    <div
                        className="testimonial-track"
                        style={{
                            transform: `translateX(calc(${(testimonials.length - 1) / 2 * 1000}px - ${activeIdx * 1000}px))`
                        }}
                    >
                        {testimonials.map((t, i) => (
                            <div key={i} className={`testimonial-card-premium ${i === activeIdx ? 'active' : ''}`}>
                                <div className="text-purple-500 text-6xl font-serif mb-8 opacity-20">"</div>
                                <p className="text-xl italic text-white/60 mb-10 font-medium leading-relaxed">
                                    {t.content}
                                </p>
                                <div className="flex items-center gap-5">
                                    <img
                                        src={t.avatar}
                                        alt={t.name}
                                        className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-lg shadow-purple-500/20"
                                    />
                                    <div>
                                        <div className="font-black text-sm tracking-[0.2em] uppercase">{t.name}</div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-purple-500/60 mt-1">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section className="bg-black/20">
                <div className="section-content">
                    <div className="faq-grid">
                        <div className="faq-title-area">
                            <div className="text-purple-500 font-black uppercase tracking-[0.4em] text-xs mb-8">FAQ</div>
                            <h2 className="text-6xl font-black tracking-tighter mb-8 leading-[0.9]">Frequently<br />asked<br />questions</h2>
                            <p className="text-white/30 text-lg font-medium max-w-sm">
                                Can't find what you're looking for? Reach out to our community on Discord.
                            </p>
                        </div>

                        <div className="faq-accordion-list">
                            {faqs.map((faq, i) => (
                                <div
                                    key={i}
                                    className={`faq-item ${activeFaq === i ? 'active' : ''}`}
                                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                >
                                    <div className="faq-question-wrap">
                                        <h4 className="faq-question">{faq.question}</h4>
                                        <div className="faq-icon">+</div>
                                    </div>
                                    <div className="faq-answer">
                                        <p className="faq-answer-text">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="cta-section">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="cta-card"
                >
                    <div className="cta-glow" />
                    <h2 className="cta-title">Ready to trade the future with decentralized precision?</h2>
                    <button className="cta-button" onClick={scrollToTop}>
                        Start now
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateY(1px)' }}>
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </button>
                </motion.div>
            </section>

            {/* FOOTER SECTION */}
            <footer className="py-24 px-10 border-t border-white/5 bg-black relative z-10 w-full overflow-hidden">
                <div className="huge-footer-logo">KASNOMO</div>

                <div className="footer-meta">
                    <div className="footer-meta-item">2026 © All rights reserved</div>

                    <div className="footer-link-group">
                        <a href="#" className="footer-meta-item">Twitter</a>
                        <a href="#" className="footer-meta-item">Discord</a>
                        <a href="#" className="footer-meta-item">Instagram</a>
                    </div>

                    <div className="footer-link-group">
                        <a href="#" className="footer-meta-item">Terms</a>
                        <a href="#" className="footer-meta-item">Privacy</a>
                        <a href="#" className="footer-meta-item">Cookies</a>
                    </div>
                </div>
            </footer>
        </main>
    );
}
