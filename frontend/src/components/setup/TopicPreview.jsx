import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronDown, ChevronUp, MessageSquare, 
    Star, Clock, BarChart3 
} from 'lucide-react';
import './TopicPreview.css';

const TOPIC_DATA = {
    general: {
        name: 'General',
        description: 'Common interview questions covering various aspects',
        estimatedTime: '5-7 min per question',
        difficulty: 'Mixed',
        sampleQuestions: [
            "Tell me about yourself and your background.",
            "What are your greatest strengths and weaknesses?",
            "Where do you see yourself in 5 years?",
            "Why are you interested in this position?"
        ]
    },
    technical: {
        name: 'Technical',
        description: 'Coding, algorithms, and technical problem-solving',
        estimatedTime: '10-15 min per question',
        difficulty: 'Medium-Hard',
        sampleQuestions: [
            "Explain the difference between stack and heap memory.",
            "How would you design a URL shortener?",
            "What is the time complexity of quicksort?",
            "Explain REST vs GraphQL."
        ]
    },
    behavioral: {
        name: 'Behavioral',
        description: 'Past experiences and how you handle situations',
        estimatedTime: '5-10 min per question',
        difficulty: 'Medium',
        sampleQuestions: [
            "Tell me about a time you faced a conflict at work.",
            "Describe a situation where you showed leadership.",
            "How do you handle tight deadlines?",
            "Tell me about a failure and what you learned."
        ]
    },
    'system-design': {
        name: 'System Design',
        description: 'Architecture and large-scale system design',
        estimatedTime: '15-20 min per question',
        difficulty: 'Hard',
        sampleQuestions: [
            "Design a chat application like WhatsApp.",
            "How would you design Twitter's news feed?",
            "Design a distributed cache system.",
            "Architect a video streaming platform."
        ]
    },
    'case-study': {
        name: 'Case Study',
        description: 'Business analysis and strategic thinking',
        estimatedTime: '15-20 min per case',
        difficulty: 'Hard',
        sampleQuestions: [
            "How would you increase revenue for a coffee shop?",
            "Should we enter the Asian market?",
            "How would you launch a new product line?",
            "Analyze the competitive landscape for ride-sharing."
        ]
    },
    leadership: {
        name: 'Leadership',
        description: 'Management and leadership experiences',
        estimatedTime: '8-12 min per question',
        difficulty: 'Medium',
        sampleQuestions: [
            "How do you motivate underperforming team members?",
            "Describe your management philosophy.",
            "How do you make difficult decisions?",
            "Tell me about building a team from scratch."
        ]
    }
};

const TopicPreview = ({ topics = [], onTopicSelect, selectedTopics = [] }) => {
    const [expandedTopic, setExpandedTopic] = useState(null);
    
    const toggleExpand = (topicId) => {
        setExpandedTopic(expandedTopic === topicId ? null : topicId);
    };
    
    const availableTopics = topics.length > 0 
        ? topics 
        : Object.keys(TOPIC_DATA);
    
    return (
        <div className="topic-preview">
            <div className="topic-list">
                {availableTopics.map((topicId) => {
                    const topic = TOPIC_DATA[topicId] || {
                        name: topicId,
                        description: 'Practice questions for this topic',
                        sampleQuestions: []
                    };
                    const isExpanded = expandedTopic === topicId;
                    const isSelected = selectedTopics.includes(topicId);
                    
                    return (
                        <motion.div
                            key={topicId}
                            className={`topic-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                            layout
                        >
                            <div 
                                className="topic-header"
                                onClick={() => toggleExpand(topicId)}
                            >
                                <div className="topic-info">
                                    <h4 className="topic-name">{topic.name}</h4>
                                    <p className="topic-desc">{topic.description}</p>
                                </div>
                                
                                <div className="topic-actions">
                                    <button
                                        className={`select-btn ${isSelected ? 'selected' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTopicSelect?.(topicId);
                                        }}
                                    >
                                        {isSelected ? 'Selected' : 'Select'}
                                    </button>
                                    <button className="expand-btn">
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                </div>
                            </div>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        className="topic-details"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="details-meta">
                                            <span className="meta-badge">
                                                <Clock size={14} />
                                                {topic.estimatedTime}
                                            </span>
                                            <span className="meta-badge">
                                                <BarChart3 size={14} />
                                                {topic.difficulty}
                                            </span>
                                        </div>
                                        
                                        <div className="sample-questions">
                                            <h5>
                                                <Star size={14} />
                                                Sample Questions
                                            </h5>
                                            <ul>
                                                {topic.sampleQuestions?.map((q, i) => (
                                                    <li key={i}>
                                                        <MessageSquare size={12} />
                                                        {q}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export { TOPIC_DATA };
export default TopicPreview;
