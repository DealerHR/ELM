/*
  # Seed Growth Profile Questions

  1. Changes
    - Inserts 50 scientifically designed questions across 5 dimensions
    - 10 questions per dimension covering all sub-dimensions
    - Mix of situational, behavioral, and attitudinal questions
    - Reverse-scored items included for response pattern detection
    
  2. Question Distribution
    - Adaptability & Learning Agility: Q1-Q10
    - Initiative & Ownership: Q11-Q20
    - Collaboration & Team Dynamics: Q21-Q30
    - Resilience & Stress Management: Q31-Q40
    - Growth Orientation & Curiosity: Q41-Q50
*/

-- Dimension 1: Adaptability & Learning Agility (ALA)
INSERT INTO growth_profile_questions (question_number, dimension, sub_dimension, question_text, question_type, answer_scale, option_1, option_2, option_3, option_4, option_5, is_reverse_scored, sub_dimension_weight) VALUES

(1, 'adaptability_learning', 'change_embrace', 'Your company announces a major restructuring that changes your role responsibilities. How do you typically react?', 'situational', 'likert_5', 'Feel anxious and resist the changes', 'Accept changes but feel uncomfortable', 'Adapt to changes with some adjustment time', 'Welcome changes as opportunities', 'Actively embrace and drive the changes', false, 0.25),

(2, 'adaptability_learning', 'learning_speed', 'How quickly can you typically master a new software tool or system required for your work?', 'behavioral_frequency', 'likert_5', 'Takes me several weeks with training', 'Takes me 1-2 weeks with guidance', 'Learn in a few days with documentation', 'Learn within a day through exploration', 'Master in hours by experimenting', false, 0.25),

(3, 'adaptability_learning', 'ambiguity_tolerance', 'I prefer to work on projects where all requirements and expectations are clearly defined from the start.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25),

(4, 'adaptability_learning', 'problem_solving', 'A critical process fails and there is no documented solution. What is your approach?', 'situational', 'likert_5', 'Wait for someone else to fix it', 'Ask for help immediately', 'Try standard solutions first', 'Analyze and test multiple approaches', 'Innovate a creative solution quickly', false, 0.25),

(5, 'adaptability_learning', 'change_embrace', 'When processes I have used for years are replaced with new methods, I...', 'behavioral_frequency', 'likert_5', 'Resist and prefer the old way', 'Comply reluctantly', 'Accept and learn the new way', 'Enthusiastically adopt new methods', 'Help others transition to new methods', false, 0.25),

(6, 'adaptability_learning', 'learning_speed', 'Your manager assigns you a task requiring skills you do not have. How confident are you in learning and delivering?', 'situational', 'likert_5', 'Not confident, would decline', 'Anxious but will try', 'Moderately confident with support', 'Confident I can learn it', 'Very confident, excited by challenge', false, 0.25),

(7, 'adaptability_learning', 'ambiguity_tolerance', 'I work best when I have complete information and clear guidelines for every aspect of my work.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25),

(8, 'adaptability_learning', 'problem_solving', 'How often do you find yourself creating new solutions rather than following existing procedures?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.25),

(9, 'adaptability_learning', 'change_embrace', 'When industry trends shift, requiring you to update your skills, you...', 'situational', 'likert_5', 'Feel overwhelmed and stressed', 'Worry about keeping up', 'Update skills when required', 'Proactively learn new trends', 'Lead others in adopting trends', false, 0.25),

(10, 'adaptability_learning', 'learning_speed', 'Compared to colleagues, I typically need more time to feel comfortable with new responsibilities.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25)

ON CONFLICT (question_number) DO NOTHING;

-- Dimension 2: Initiative & Ownership (IO)
INSERT INTO growth_profile_questions (question_number, dimension, sub_dimension, question_text, question_type, answer_scale, option_1, option_2, option_3, option_4, option_5, is_reverse_scored, sub_dimension_weight) VALUES

(11, 'initiative_ownership', 'self_direction', 'How often do you need your manager to check in on your progress to stay on track?', 'behavioral_frequency', 'frequency_5', 'Multiple times daily', 'Daily', 'Few times per week', 'Weekly', 'Rarely or never', true, 0.30),

(12, 'initiative_ownership', 'proactive_behavior', 'You notice a recurring problem that affects your team efficiency but is not your direct responsibility. You...', 'situational', 'likert_5', 'Ignore it, not my job', 'Mention it to someone', 'Inform my manager', 'Propose a solution', 'Fix it and implement solution', false, 0.25),

(13, 'initiative_ownership', 'accountability', 'When a project you led does not meet expectations, what is your typical response?', 'situational', 'likert_5', 'Blame external factors', 'Point out team issues', 'Share responsibility broadly', 'Take partial ownership', 'Take full ownership and learn', false, 0.25),

(14, 'initiative_ownership', 'resource_optimization', 'Your project is allocated limited budget and resources. How do you proceed?', 'situational', 'likert_5', 'Request more resources first', 'Complain about constraints', 'Do minimum with what I have', 'Find creative workarounds', 'Excel by maximizing every resource', false, 0.20),

(15, 'initiative_ownership', 'self_direction', 'I prefer to receive detailed instructions before starting any task.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.30),

(16, 'initiative_ownership', 'proactive_behavior', 'How often do you identify and act on opportunities to improve processes before being asked?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.25),

(17, 'initiative_ownership', 'accountability', 'I tend to focus more on what went wrong with the team rather than my own contributions to problems.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25),

(18, 'initiative_ownership', 'resource_optimization', 'When faced with a challenge and limited resources, I...', 'behavioral_frequency', 'likert_5', 'Wait for more resources', 'Work with what is available reluctantly', 'Make do adequately', 'Find innovative alternatives', 'Thrive on the constraint', false, 0.20),

(19, 'initiative_ownership', 'self_direction', 'Your manager will be unavailable for two weeks. How confident are you in managing your work independently?', 'situational', 'likert_5', 'Very uncomfortable, need guidance', 'Somewhat uncomfortable', 'Can manage with effort', 'Comfortable and capable', 'Completely comfortable, prefer it', false, 0.30),

(20, 'initiative_ownership', 'proactive_behavior', 'I wait for problems to be assigned to me rather than seeking them out.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25)

ON CONFLICT (question_number) DO NOTHING;

-- Dimension 3: Collaboration & Team Dynamics (CTD)
INSERT INTO growth_profile_questions (question_number, dimension, sub_dimension, question_text, question_type, answer_scale, option_1, option_2, option_3, option_4, option_5, is_reverse_scored, sub_dimension_weight) VALUES

(21, 'collaboration_team', 'communication', 'How would you describe your communication style in team settings?', 'situational', 'likert_5', 'Rarely speak up', 'Share only when asked', 'Contribute when relevant', 'Actively communicate', 'Lead discussions effectively', false, 0.30),

(22, 'collaboration_team', 'team_support', 'A colleague is struggling with their workload. You are also busy. What do you do?', 'situational', 'likert_5', 'Focus on my own work', 'Sympathize but cannot help', 'Help if specifically asked', 'Offer specific assistance', 'Proactively help and coordinate support', false, 0.25),

(23, 'collaboration_team', 'conflict_resolution', 'You strongly disagree with a teammate approach. How do you handle it?', 'situational', 'likert_5', 'Avoid the conflict', 'Complain to others', 'State my disagreement', 'Discuss differences constructively', 'Find collaborative solution', false, 0.20),

(24, 'collaboration_team', 'cross_functional_work', 'How comfortable are you working with teams from different departments with different priorities?', 'behavioral_frequency', 'likert_5', 'Very uncomfortable', 'Somewhat uncomfortable', 'Neutral', 'Comfortable', 'Very comfortable, enjoy it', false, 0.25),

(25, 'collaboration_team', 'communication', 'I prefer to work independently rather than spend time communicating with team members.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.30),

(26, 'collaboration_team', 'team_support', 'How often do you share knowledge or resources that could help your colleagues?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.25),

(27, 'collaboration_team', 'conflict_resolution', 'When team conflicts arise, I tend to withdraw and let others resolve them.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.20),

(28, 'collaboration_team', 'cross_functional_work', 'A project requires coordinating with three different departments. What is your reaction?', 'situational', 'likert_5', 'Overwhelmed, prefer single team', 'Anxious about coordination', 'Can manage if necessary', 'See it as interesting challenge', 'Excited by cross-functional work', false, 0.25),

(29, 'collaboration_team', 'communication', 'In meetings, how often do you ensure everyone understands decisions and next steps?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.30),

(30, 'collaboration_team', 'team_support', 'I believe everyone should handle their own responsibilities without expecting help from others.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25)

ON CONFLICT (question_number) DO NOTHING;

-- Dimension 4: Resilience & Stress Management (RSM)
INSERT INTO growth_profile_questions (question_number, dimension, sub_dimension, question_text, question_type, answer_scale, option_1, option_2, option_3, option_4, option_5, is_reverse_scored, sub_dimension_weight) VALUES

(31, 'resilience_stress', 'stress_tolerance', 'You are managing three urgent deadlines simultaneously. How do you typically perform?', 'situational', 'likert_5', 'Performance drops significantly', 'Struggle but complete tasks', 'Maintain adequate performance', 'Perform well under pressure', 'Excel and prioritize effectively', false, 0.30),

(32, 'resilience_stress', 'emotional_stability', 'When facing setbacks at work, how much do they affect your mood and attitude?', 'behavioral_frequency', 'likert_5', 'Significantly impact me for days', 'Noticeably affect my mood', 'Temporarily upset me', 'Briefly bother me', 'Rarely affect my disposition', true, 0.25),

(33, 'resilience_stress', 'recovery_speed', 'After a major project failure or criticism, how long does it take you to refocus and move forward?', 'behavioral_frequency', 'likert_5', 'Several weeks', 'About a week', 'A few days', 'Within a day', 'Almost immediately', false, 0.20),

(34, 'resilience_stress', 'optimism', 'Your company faces significant business challenges. What is your outlook?', 'situational', 'likert_5', 'Very pessimistic about future', 'Concerned and worried', 'Cautiously uncertain', 'Cautiously optimistic', 'Confident we will overcome', false, 0.25),

(35, 'resilience_stress', 'stress_tolerance', 'I find it difficult to maintain quality work when under significant time pressure.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.30),

(36, 'resilience_stress', 'emotional_stability', 'How consistent is your energy and attitude at work, regardless of daily challenges?', 'behavioral_frequency', 'frequency_5', 'Highly variable', 'Often fluctuates', 'Sometimes varies', 'Usually consistent', 'Always steady', false, 0.25),

(37, 'resilience_stress', 'recovery_speed', 'I tend to dwell on mistakes and have difficulty moving past them.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.20),

(38, 'resilience_stress', 'optimism', 'When obstacles arise, how often do you maintain a positive, solution-focused mindset?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.25),

(39, 'resilience_stress', 'stress_tolerance', 'Your workload suddenly doubles due to organizational changes. Your response is to...', 'situational', 'likert_5', 'Feel overwhelmed and burn out', 'Stress significantly', 'Manage with difficulty', 'Adapt and handle it', 'Thrive on the challenge', false, 0.30),

(40, 'resilience_stress', 'emotional_stability', 'Unexpected problems at work tend to throw off my entire day.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25)

ON CONFLICT (question_number) DO NOTHING;

-- Dimension 5: Growth Orientation & Curiosity (GOC)
INSERT INTO growth_profile_questions (question_number, dimension, sub_dimension, question_text, question_type, answer_scale, option_1, option_2, option_3, option_4, option_5, is_reverse_scored, sub_dimension_weight) VALUES

(41, 'growth_curiosity', 'growth_mindset', 'I believe my abilities and intelligence are mostly fixed and cannot be significantly changed.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.30),

(42, 'growth_curiosity', 'intellectual_curiosity', 'How often do you seek out new information or skills beyond what is required for your current role?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Constantly', false, 0.25),

(43, 'growth_curiosity', 'feedback_receptivity', 'Your manager provides critical feedback on your performance. What is your typical reaction?', 'situational', 'likert_5', 'Defensive and upset', 'Uncomfortable but listen', 'Accept it neutrally', 'Welcome and appreciate it', 'Actively seek more feedback', false, 0.25),

(44, 'growth_curiosity', 'innovation_tendency', 'When completing routine tasks, how often do you think about ways to improve them?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always', false, 0.20),

(45, 'growth_curiosity', 'growth_mindset', 'When facing a skill gap, what is your typical thought process?', 'situational', 'likert_5', 'I am not good at this', 'This is too hard for me', 'I might be able to learn', 'I can definitely learn this', 'Excited to develop this skill', false, 0.30),

(46, 'growth_curiosity', 'intellectual_curiosity', 'I prefer to stick with what I know rather than exploring new areas or topics.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.25),

(47, 'growth_curiosity', 'feedback_receptivity', 'How often do you proactively ask for feedback on your work?', 'behavioral_frequency', 'frequency_5', 'Never', 'Rarely', 'Sometimes', 'Often', 'Very frequently', false, 0.25),

(48, 'growth_curiosity', 'innovation_tendency', 'I am satisfied with doing things the way they have always been done.', 'attitudinal', 'likert_5', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', true, 0.20),

(49, 'growth_curiosity', 'growth_mindset', 'Failure and mistakes are...', 'situational', 'likert_5', 'Things to avoid at all costs', 'Unpleasant setbacks', 'Unavoidable sometimes', 'Learning opportunities', 'Essential for growth', false, 0.30),

(50, 'growth_curiosity', 'intellectual_curiosity', 'How many professional development activities (courses, reading, conferences) do you engage in yearly?', 'behavioral_frequency', 'likert_5', 'None', '1-2', '3-5', '6-10', 'More than 10', false, 0.25)

ON CONFLICT (question_number) DO NOTHING;
