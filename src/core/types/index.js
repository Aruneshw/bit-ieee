"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ADMIN_EMAILS = exports.ADMIN_EMAILS = exports.ADMIN_ROLES = exports.SKILL_OPTIONS = exports.DEPARTMENTS = void 0;
exports.isAdmin = isAdmin;
exports.isPrimaryAdmin = isPrimaryAdmin;
exports.needsProfileCompletion = needsProfileCompletion;
exports.getRoleLabel = getRoleLabel;
exports.getRoleColor = getRoleColor;
exports.getRoleDashboardPath = getRoleDashboardPath;
// Constants
exports.DEPARTMENTS = [
    'CSE', 'AIML', 'ECE', 'EEE', 'Mechanical',
    'IT', 'AIDS', 'Biomedical', 'Mechatronics', 'EIE',
];
exports.SKILL_OPTIONS = [
    'Additive Manufacturing (3D Printing)',
    'Agentic AI & LLM Optimization',
    'Autonomous Mobile Robotics (AMR)',
    'Battery Management Systems (BMS)',
    'Big Data Analytics and Machine Learning',
    'Bio-Process Engineering',
    'Bioinformatics and Data Analytics',
    'Blockchain Technology',
    'Cloud Computing',
    'Computational Fluid Dynamics (CFD)',
    'Computer Vision and Image Processing',
    'Control System',
    'Cyber Security and Cryptography',
    'Data Acquisition System',
    'Design for Manufacturing and Assembly',
    'DevOps and IT Infra',
    'Digital Signal Processing',
    'Edge AI',
    'Embedded Systems & Firmware',
    'FPGA Prototyping',
    'Full-Stack Software Development',
    'IoT and Sensor Integration',
    'Manufacturing and Fabrication',
    'Mechanical Engineering CAD and FEA',
    'Mechanical Modelling',
    'Mechanisms Design',
    'Microbial and Plant Bioprospecting',
    'Molecular Biology and Genetic Engineering',
    'Natural Language Processing',
    'PCB Design and Development',
    'PLC and Industrial Control',
    'Pneumatics & Electro-Pneumatics',
    'Power Electronics & Grid Integration',
    'Power System',
    'Precision Agriculture (Agri-Tech)',
    'Robot Systems Integration',
    'Servo-Drives & Motion Control',
    'Unmanned Aerial Systems',
    'VLSI & Circuit Design',
];
// Role hierarchy helpers
exports.ADMIN_ROLES = ['admin_primary'];
exports.ADMIN_EMAILS = [
    'bitieeehubadmin1@gmail.com',
    'bitieeehubadmin2@gmail.com',
    'aruneshownsty1@gmail.com',
    'bitieeehubadmin3@gmail.com',
    'bitieeehubadmin4@gmail.com',
];
exports.ALL_ADMIN_EMAILS = [...exports.ADMIN_EMAILS];
function isAdmin(role) {
    return role === 'admin_primary';
}
function isPrimaryAdmin(role) {
    return role === 'admin_primary';
}
function needsProfileCompletion(role) {
    return ['leadership', 'membership'].includes(role);
}
function getRoleLabel(role) {
    const labels = {
        admin_primary: 'Admin',
        student_rep: 'Student Rep',
        leadership: 'Leadership',
        membership: 'Member',
        event_manager: 'Event Manager',
    };
    return labels[role] || role;
}
function getRoleColor(role) {
    const colors = {
        admin_primary: 'bg-red-500/20 text-red-400 border-red-500/30',
        student_rep: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        leadership: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        membership: 'bg-green-500/20 text-green-400 border-green-500/30',
        event_manager: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return colors[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}
function getRoleDashboardPath(role) {
    switch (role) {
        case 'admin_primary': return '/admin/dashboard';
        case 'student_rep': return '/rep/dashboard';
        case 'leadership': return '/leadership/dashboard';
        case 'event_manager': return '/leadership/dashboard';
        case 'membership': return '/member/dashboard';
        default: return '/member/dashboard';
    }
}
