import React from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Target, Award, AlertCircle, Lightbulb } from 'lucide-react';
import './AIInsightsPanel.css';

const AIInsightsPanel = ({ 
    insights = [], // [{ type, title, description, metric?, action? }]
    isLoading = false,
    onActionClick 
}) => {
    const defaultInsights = [
        {
            type: 'improvement',
            icon: TrendingUp,
            title: 'You improved 23% in System Design',
            description: 'Your architecture explanations are now more structured and comprehensive.',
            metric: '+23%',
            action: 'Practice more'
        },
        {
            type: 'strength',
            icon: Award,
            title: 'Strong STAR method usage',
            description: 'You consistently structure behavioral answers with clear situations, tasks, actions, and results.',
            metric: '92%'
        },
        {
            type: 'focus',
            icon: Target,
            title: 'Focus area: Technical depth',
            description: 'Consider diving deeper into implementation details during technical questions.',
            action: 'View exercises'
        },
        {
            type: 'tip',
            icon: Lightbulb,
            title: 'Quick win opportunity',
            description: 'Reducing filler words by 50% could improve your perceived confidence significantly.',
            action: 'Learn how'
        }
    ];
    
    const displayInsights = insights.length > 0 ? insights : defaultInsights;
    
    const getTypeColor = (type) => {
        switch (type) {
            case 'improvement': return '#10b981';
            case 'strength': return '#6366f1';
            case 'focus': return '#f97316';
            case 'warning': return '#ef4444';
            case 'tip': return '#fbbf24';
            default: return '#a5b4fc';
        }
    };
    
    const getIcon = (insight) => {
        if (insight.icon) return insight.icon;
        switch (insight.type) {
            case 'improvement': return TrendingUp;
            case 'strength': return Award;
            case 'focus': return Target;
            case 'warning': return AlertCircle;
            case 'tip': return Lightbulb;
            default: return Brain;
        }
    };
    
    return (
        <div className="ai-insights-panel">
            <div className="insights-header">
                <Brain size={20} />
                <h3>AI Insights</h3>
                <span className="ai-badge">Powered by AI</span>
            </div>
            
            {isLoading ? (
                <div className="insights-loading">
                    <div className="loading-shimmer" />
                    <div className="loading-shimmer short" />
                    <div className="loading-shimmer" />
                </div>
            ) : (
                <div className="insights-list">
                    {displayInsights.map((insight, index) => {
                        const Icon = getIcon(insight);
                        const color = getTypeColor(insight.type);
                        
                        return (
                            <motion.div
                                key={index}
                                className={`insight-card ${insight.type}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <div 
                                    className="insight-icon"
                                    style={{ backgroundColor: `${color}20`, color }}
                                >
                                    <Icon size={18} />
                                </div>
                                
                                <div className="insight-content">
                                    <h4 className="insight-title">{insight.title}</h4>
                                    <p className="insight-desc">{insight.description}</p>
                                    
                                    {(insight.metric || insight.action) && (
                                        <div className="insight-footer">
                                            {insight.metric && (
                                                <span 
                                                    className="insight-metric"
                                                    style={{ color }}
                                                >
                                                    {insight.metric}
                                                </span>
                                            )}
                                            {insight.action && (
                                                <button
                                                    className="insight-action"
                                                    onClick={() => onActionClick?.(insight)}
                                                >
                                                    {insight.action} →
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AIInsightsPanel;
