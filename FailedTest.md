5. Member Management & Statuses

Test ID	Scenario / Description	Expected Result	Status	Comments
TC-056	Directory - Active Members Fetch	Renders all active members from Firestore.	FAILED	Guest role blocked by missing Firestore read rules
TC-057	Directory Search - Matching Query	Filters list dynamically by name keyword.	FAILED	Blocked by TC-056
TC-058	Directory Search - No Match Query	Displays "No members found" empty state.	FAILED	Blocked by TC-056
TC-059	Directory Filter - Plan Selection	Filters list to display matching plan badge.	FAILED	Blocked by TC-056
TC-060	Directory Filter - Plan with No Enrollments	Displays empty filter state.	FAILED	Blocked by TC-056
TC-061	Status Badges - Paid Member	Renders green "✅ Paid" badge.	FAILED	Blocked by TC-056
TC-062	Status Badges - Overdue Member	Renders red "🔴 Overdue" badge.	FAILED	Blocked by TC-056
TC-063	Status Badges - Due Soon Member	Renders yellow "🟡 Due Soon" badge.	FAILED	Blocked by TC-056
TC-064	Member Stats - Total Count Display	Displays correct number of active members.	PASS	Verified for Admin
TC-065	Member Stats - Overdue Count Display	Displays correct count of overdue members.	PASS	Verified for Admin
TC-066	Member Stats - Due Soon Count Display	Displays correct count of due soon members.	PASS	Verified for Admin
TC-067	Table Action - Mark Paid Click	Activates inline confirmation widget.	PASS	Verified for Admin
TC-068	Table Action - Confirm Payment Cancel	Reverts confirmation widget without writing database.	PASS	Verified for Admin
TC-069	Table Action - Confirm Payment Yes	Updates lastPaidDate successfully and alerts dismiss.	PASS	Verified for Admin
TC-070	Guest Member Payments Action	Action column is entirely hidden from Guest UI.	PASS	Verified
6. Fee Alert Management
Test ID	Scenario / Description	Expected Result	Status	Comments
TC-071	Alerts List - Alerts Loading	Renders pending fee collection items.	FAILED	Guest role blocked by missing Firestore read rules
TC-072	Filter Tabs - All Alerts	Shows both Overdue and Due Soon alerts.	FAILED	Blocked by TC-071
TC-073	Filter Tabs - Overdue Filter	Filters list to only show overdue alerts.	FAILED	Blocked by TC-071
TC-074	Filter Tabs - Upcoming Filter	Filters list to only show due soon alerts.	FAILED	Blocked by TC-071


 Fee Alert Management
Test ID	Scenario / Description	Expected Result	Status	Comments
TC-071	Alerts List - Alerts Loading	Renders pending fee collection items.	FAILED	Guest role blocked by missing Firestore read rules
TC-072	Filter Tabs - All Alerts	Shows both Overdue and Due Soon alerts.	FAILED	Blocked by TC-071
TC-073	Filter Tabs - Overdue Filter	Filters list to only show overdue alerts.	FAILED	Blocked by TC-071
TC-074	Filter Tabs - Upcoming Filter	Filters list to only show due soon alerts.	FAILED	Blocked by TC-071