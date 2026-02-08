import React from 'react';
import { motion } from 'framer-motion';
import './TrustLogos.css';

const TrustLogos = () => {
    const companies = [
        { name: 'Google', logo: 'G' },
        { name: 'Amazon', logo: 'A' },
        { name: 'Microsoft', logo: 'M' },
        { name: 'Meta', logo: 'f' },
        { name: 'Apple', logo: '' },
        { name: 'Netflix', logo: 'N' },
        { name: 'Tesla', logo: 'T' },
        { name: 'Uber', logo: 'U' }
    ];

    return (
        <motion.div 
            className="trust-logos-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
        >
            <p className="trust-text">
                <span className="trust-highlight">10,000+</span> candidates prepared for interviews at
            </p>
            
            <div className="logos-track-wrapper">
                <div className="logos-track">
                    {[...companies, ...companies].map((company, index) => (
                        <div key={index} className="logo-item">
                            <span className="logo-letter">{company.logo}</span>
                            <span className="logo-name">{company.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="trust-badges">
                <div className="trust-badge">
                    <span className="badge-icon">🔒</span>
                    <span className="badge-text">Privacy First</span>
                </div>
                <div className="trust-badge">
                    <span className="badge-icon">⚡</span>
                    <span className="badge-text">AI Powered</span>
                </div>
                <div className="trust-badge">
                    <span className="badge-icon">🏆</span>
                    <span className="badge-text">4.9/5 Rating</span>
                </div>
            </div>
        </motion.div>
    );
};

export default TrustLogos;
