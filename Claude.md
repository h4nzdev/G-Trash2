
G-TRASH: Smart Waste Monitoring System using IoT, AI, and Mobile Application
1. Introduction
Waste management is a major challenge in urban areas such as Cebu. Garbage collection often follows fixed schedules that do not adapt to real-time conditions, leading to overflowing trash, bad odors, and environmental health risks.
Many residents do not report issues due to:
Busy schedules
Complicated reporting processes
Hesitation or fear of confrontation
Belief that authorities are already aware
Additionally, some barangays lack their own garbage trucks and rely on shared trucks, resulting in delays and inefficient waste collection.
This project proposes a smart system that integrates IoT, Artificial Intelligence (AI), and a mobile/web application to provide real-time monitoring, automation, and improved coordination.

2. Objectives
General Objective
To develop a smart waste monitoring system that uses IoT and AI to improve garbage collection efficiency and reduce pollution.
Specific Objectives
Detect air pollution levels in garbage areas automatically
Provide real-time alerts to users and authorities
Track garbage trucks and visualize routes
Display pollution levels using heatmaps
Reduce reliance on manual reporting
Improve coordination between barangays
Provide data-driven insights for decision-making

3. Proposed Solution
The system introduces an automated, data-driven approach:
IoT sensors are installed in garbage-prone areas
Sensors detect harmful gases and environmental conditions
Data is sent to a central system via the internet
AI analyzes the data and identifies patterns
Alerts are triggered when pollution exceeds safe levels
Users access real-time data through a mobile/web app
The system also includes garbage truck tracking, route visualization, and role-based access for better usability.

4. System Features
4.1 IoT-Based Air Monitoring
Detects ammonia, methane, and pollutants
Installed in garbage bins or critical areas
Sends real-time environmental data

4.2 Real-Time Notification System
Alerts when pollution levels are high
Notifies residents, officials, and collectors

4.3 AI-Based Analysis
Analyzes pollution patterns
Provides recommendations such as:
Increasing collection frequency
Identifying high-risk time periods

4.4 Garbage Truck Tracking
Real-time truck location
Estimated arrival time for users

4.5 Smart Radius Notification (3-Layer System)
Distance-based alerts:
Far → early notice
Medium → preparation
Near → immediate action

4.6 Barangay Route Visualization
Dropdown selection of barangay
Displays route similar to jeepney routes
Example:
Ayala → SM → Lahug

4.7 Heatmap Visualization
Map-based pollution display:
Red = High
Yellow = Moderate
Green = Safe

4.8 Data Analytics Dashboard
Pollution trends
Most affected areas
Historical data logs

4.9 Calendar and Scheduling
Shows garbage collection schedules
Helps users plan waste disposal

4.10 Waste Management Notifications
Reminders for garbage disposal
Alerts for schedule changes

4.11 Segregation Instruction
Guides users on proper waste segregation
Improves environmental awareness

4.12 AI Scanner
Allows users to scan trash items
AI suggests proper disposal or segregation

5. Role-Based Access System
5.1 Residents (Users)
Features:
View map with heatmap
Track garbage trucks
View routes
Receive real-time notifications (3-layer system)
Submit reports
View calendar schedules
Receive waste management notifications
Access segregation instructions
Use AI scanner

5.2 Garbage Truck Collectors
Features:
View heatmap status
Access routes
See assigned pickup locations
Identify trash-prone areas
Update system:
Mark areas as cleaned (Green)

5.3 Officials (Barangay / Government)
Features:
View data reports on collected trash
Access analytics dashboard
Monitor urgency levels of problems
Evaluate reports and system performance

5.4 Admin Panel (Developers)
Features:
Monitor total trash collected
View heatmap status and urgency levels
Track number of garbage trucks deployed
Analyze problem scaling based on urgency
Manage bug reports and user feedback
Handle system notifications and updates

6. Leaderboard and Reward System
6.1 Barangay Leaderboard
Ranking of barangays based on performance
6.2 Reward System (Pending)
Incentives for officials based on performance
To be finalized after interviews
6.3 Categories
Best in Segregation
Most Trash Collected

7. User Limitation
One account per household
Limit number of users per area
Helps maintain accurate data and avoid spam

8. System Architecture
Data Flow
IoT Sensor → Microcontroller → Internet → Backend → Database → Application
Explanation
Sensors collect environmental data
ESP32 sends data via WiFi
Backend processes and analyzes data
Database stores information
Frontend displays data to users

9. Technologies to be Used
Hardware
ESP32
MQ-135 Gas Sensor
Optional:
DHT11
Ultrasonic Sensor

Software
Frontend:
React
Backend:
Flask or Node.js
Database:
SQLite / MongoDB / MySQL

10. AI Implementation (Simplified)
Rule-based logic:
High gas level → alert
Repeated high readings → recommendation
Advantages:
Easy to implement
Reliable
Real-time capable

11. Expected Outputs
Real-time monitoring system
Notification system
Garbage truck tracking
Route visualization
Heatmap display
Data analytics dashboard
Role-based system access
AI-assisted features

12. Benefits of the System
Improves waste collection efficiency
Reduces pollution and health risks
Provides real-time monitoring
Supports decision-making
Encourages community participation
Enhances barangay coordination

13. Limitations
Requires internet connection
Sensor accuracy may vary
Initial hardware cost

14. Research Methodology
Method Used: Mixed Method
Quantitative:
Sensor data
System analytics
Qualitative:
Interviews
User feedback

15. Participants
Residents (Google Forms survey)
Waste Management Head (Interview)
Barangay Officials (Interview)

16. Interview Focus
How barangays collect waste from:
Hospitals
Stores
Other establishments
This helps improve system accuracy and real-world application.

17. Future Enhancements
Full mobile app deployment
Advanced AI predictions
SMS alerts
Smart city integration
Additional sensors

18. Conclusion
The G-TRASH system provides a smart and efficient solution to modern waste management problems. By integrating IoT, AI, and real-time tracking, the system transforms traditional processes into an automated and proactive approach. It improves efficiency, reduces pollution, and enhances community participation.


