import React, { useState, useEffect } from "react";
import "./App.css";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";

// Firebase config (replace with your own)
const firebaseConfig = {
  apiKey: "AIzaSyB0xrhxWjTTk2PBQ_t1Zxm4uaO8p4ezDrw",
  authDomain: "attendance-track-91a6a.firebaseapp.com",
  projectId: "attendance-track-91a6a",
  storageBucket: "attendance-track-91a6a.appspot.com",
  messagingSenderId: "442761655127",
  appId: "1:442761655127:web:9e302b6ebca27fcbfa0412",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Timetable and helper functions

const timetableData = [
  {
    day: "Monday",
    slots: ["", "DSA", "HSM", "DSA LAB", "DSA LAB", "Lunch", "", "", ""],
  },
  {
    day: "Tuesday",
    slots: ["", "OS", "CN", "PDS", "MINOR", "Lunch", "HSM", "CN LAB", "CN LAB"],
  },
  {
    day: "Wednesday",
    slots: ["", "", "OS LAB", "OS LAB", "MINOR", "Lunch", "HSM", "OS", ""],
  },
  {
    day: "Thursday",
    slots: ["", "OS", "DSA", "CN", "MINOR", "Lunch", "HSM", "PDS", ""],
  },
  {
    day: "Friday",
    slots: [
      "DSA",
      "PDS LAB",
      "PDS LAB",
      "PDS",
      "CN",
      "Lunch",
      "HSM",
      "MINOR LAB",
      "MINOR LAB",
    ],
  },
];

const totalLectures = {
  DSA: 42,
  CN: 42,
  OS: 42,
  PDS: 42,
  MINOR: 42,
  HSM: 52,
};

const totalLabs = {
  DSA: 14,
  CN: 14,
  OS: 14,
  PDS: 14,
  MINOR: 14,
  HSM: 0,
};

function isLab(subject) {
  return subject.toUpperCase().includes("LAB");
}

function normalizeSubjectName(name) {
  if (!name) return "";
  name = name.toUpperCase().trim();
  if (name === "DS" || name === "DSA") return "DSA";
  if (name.endsWith(" LAB")) return name.replace(" LAB", "");
  if (name.endsWith("LAB")) return name.replace("LAB", "");
  return name;
}

function getDayName(dateString) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  if (!dateString) return null;
  const d = new Date(dateString + "T00:00:00");
  return days[d.getDay()];
}

function calcCanMissDynamic(present, conducted, total) {
  if (total === 0) return 0;

  const remainingClasses = total - conducted;
  const requiredAttend = Math.ceil(total * 0.75);

  const mustAttendMore = Math.max(0, requiredAttend - present);

  if (mustAttendMore > remainingClasses) return 0;

  return remainingClasses - mustAttendMore;
}

export default function App() {
  const [username, setUsername] = useState("");
  const [inputName, setInputName] = useState("");
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [allDatesData, setAllDatesData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) return;

    async function fetchUserAttendance() {
      setLoading(true);
      const colRef = collection(db, "attendance");
      const snapshot = await getDocs(colRef);
      const allData = {};

      snapshot.forEach((doc) => {
        allData[doc.id] = doc.data();
      });

      const filteredData = {};
      Object.entries(allData).forEach(([date, dateData]) => {
        if (dateData[username]) {
          filteredData[date] = dateData[username];
        } else {
          filteredData[date] = {};
        }
      });

      setAllDatesData(filteredData);
      setLoading(false);
    }

    fetchUserAttendance();
  }, [username]);

  useEffect(() => {
    if (!selectedDate) return;

    if (allDatesData[selectedDate]) {
      setAttendanceData(allDatesData[selectedDate]);
    } else {
      setAttendanceData({});
    }
  }, [selectedDate, allDatesData]);

  useEffect(() => {
    if (!selectedDate || !username) return;

    const timeoutId = setTimeout(async () => {
      setLoading(true);

      const docRef = doc(db, "attendance", selectedDate);
      const docSnap = await getDoc(docRef);
      let prevData = {};
      if (docSnap.exists()) {
        prevData = docSnap.data();
      }

      const newData = {
        ...prevData,
        [username]: attendanceData,
      };

      await setDoc(docRef, newData);
      setAllDatesData((prev) => ({
        ...prev,
        [selectedDate]: attendanceData,
      }));
      setLoading(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [attendanceData, selectedDate, username]);

  function toggleCell(dayIndex, slotIndex) {
    const key = `${dayIndex}-${slotIndex}`;
    const current = attendanceData[key] || "unmarked";
    const next =
      current === "unmarked" ? "present" : current === "present" ? "absent" : "unmarked";

    const daySlots = timetableData[dayIndex].slots;
    if (isLab(daySlots[slotIndex])) {
      let partnerIndex = null;
      if (slotIndex + 1 < daySlots.length && daySlots[slotIndex + 1] === daySlots[slotIndex])
        partnerIndex = slotIndex + 1;
      else if (slotIndex - 1 >= 0 && daySlots[slotIndex - 1] === daySlots[slotIndex])
        partnerIndex = slotIndex - 1;

      setAttendanceData((prev) => ({
        ...prev,
        [key]: next,
        ...(partnerIndex !== null ? { [`${dayIndex}-${partnerIndex}`]: next } : {}),
      }));
    } else {
      setAttendanceData((prev) => ({
        ...prev,
        [key]: next,
      }));
    }
  }

  function getSummary() {
    const summary = {};

    Object.values(allDatesData).forEach((dateData) => {
      timetableData.forEach((dayRow, dayI) => {
        dayRow.slots.forEach((subjectRaw, slotIdx) => {
          if (!subjectRaw) return;
          if (subjectRaw.toLowerCase() === "lunch") return;
          const subject = normalizeSubjectName(subjectRaw);
          if (!totalLectures.hasOwnProperty(subject)) return;

          if (!summary[subject]) {
            summary[subject] = {
              lecture: { present: 0, absent: 0, total: totalLectures[subject] },
              lab: { present: 0, absent: 0, total: totalLabs[subject] },
            };
          }

          const lab = isLab(subjectRaw);
          const key = `${dayI}-${slotIdx}`;
          const status = dateData[key] || "unmarked";

          if (lab) {
            if (status === "present") summary[subject].lab.present += 1;
            if (status === "absent") summary[subject].lab.absent += 1;
          } else {
            if (status === "present") summary[subject].lecture.present += 1;
            if (status === "absent") summary[subject].lecture.absent += 1;
          }
        });
      });
    });

    return summary;
  }

  const summary = getSummary();
  const selectedDayName = getDayName(selectedDate);
  const timetableDay = timetableData.find((row) => row.day === selectedDayName) || null;

  if (!username) {
    return (
      <div
        style={{
          maxWidth: 400,
          margin: "auto",
          padding: 20,
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          textAlign: "center",
        }}
      >
        <h2>Please enter your name</h2>
        <input
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="Your name"
          style={{
            width: "100%",
            padding: "10px",
            fontSize: 16,
            borderRadius: 4,
            border: "1px solid #ccc",
            marginBottom: 10,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputName.trim()) {
              setUsername(inputName.trim());
            }
          }}
        />
        <button
          onClick={() => {
            if (inputName.trim()) setUsername(inputName.trim());
          }}
          style={{
            padding: "10px 20px",
            fontSize: 16,
            borderRadius: 4,
            border: "none",
            backgroundColor: "#1976d2",
            color: "white",
            cursor: "pointer",
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "auto",
        padding: 20,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          onClick={() => {
            setUsername("");
            setInputName("");
            setAttendanceData({});
            setAllDatesData({});
          }}
          style={{
            padding: "8px 16px",
            backgroundColor: "#e53935",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Log Out
        </button>
      </div>

      <h1 style={{ textAlign: "center", color: "#222", marginBottom: 20 }}>
        Semester Attendance Tracker
      </h1>

      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <label style={{ fontWeight: "bold", fontSize: 16 }}>
          Select Date:{" "}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "6px 10px",
              fontSize: 16,
              borderRadius: 4,
              border: "1px solid #ccc",
              width: "200px",
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          />
        </label>
        {loading && (
          <span style={{ marginLeft: 10, color: "#777", fontStyle: "italic" }}>
            Saving/Loading...
          </span>
        )}
      </div>

      {/* Timetable */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          marginBottom: 30,
          border: "1px solid red",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#333", color: "white" }}>
            <th>Day</th>
            <th data-label="8-9">8-9</th>
            <th data-label="9-10">9-10</th>
            <th data-label="10-11">10-11</th>
            <th data-label="11-12">11-12</th>
            <th data-label="12-1">12-1</th>
            <th data-label="1-2">1-2</th>
            <th data-label="2-3">2-3</th>
            <th data-label="3-4">3-4</th>
            <th data-label="4-5">4-5</th>
          </tr>
        </thead>
        <tbody>
          {timetableDay ? (
            <tr>
              <td
                style={{
                  border: "1px solid #ccc",
                  padding: "10px",
                  background: "#eee",
                  fontWeight: "bold",
                }}
                data-label="Day"
              >
                {timetableDay.day}
              </td>
              {timetableDay.slots.map((subject, slotIdx) => {
                const dayIdx = timetableData.findIndex(
                  (row) => row.day === selectedDayName
                );

                if (subject.toLowerCase() === "lunch") {
                  return (
                    <td
                      key={slotIdx}
                      className="lunch"
                      style={{
                        border: "1px solid #ccc",
                        padding: "10px",
                        cursor: "default",
                        textAlign: "center",
                        userSelect: "none",
                        fontStyle: "italic",
                      }}
                      data-label="Lunch"
                    >
                      Lunch
                    </td>
                  );
                }

                const isLabSession = isLab(subject);

                if (
                  isLabSession &&
                  slotIdx + 1 < timetableDay.slots.length &&
                  timetableDay.slots[slotIdx + 1] === subject
                ) {
                  const key = `${dayIdx}-${slotIdx}`;
                  const status = attendanceData[key] || "unmarked";

                  return (
                    <td
                      key={slotIdx}
                      colSpan={2}
                      className={status}
                      style={{
                        border: "1px solid #ccc",
                        padding: "10px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        textAlign: "center",
                        userSelect: "none",
                      }}
                      onClick={() => {
                        toggleCell(dayIdx, slotIdx);
                        toggleCell(dayIdx, slotIdx + 1);
                      }}
                      data-label={subject}
                    >
                      {subject}
                    </td>
                  );
                } else if (
                  isLabSession &&
                  slotIdx > 0 &&
                  timetableDay.slots[slotIdx - 1] === subject
                ) {
                  return null;
                } else {
                  const key = `${dayIdx}-${slotIdx}`;
                  const status = attendanceData[key] || "unmarked";

                  return (
                    <td
                      key={slotIdx}
                      className={status}
                      style={{
                        border: "1px solid #ccc",
                        padding: "10px",
                        cursor: subject ? "pointer" : "default",
                        textAlign: "center",
                        userSelect: "none",
                      }}
                      onClick={() => subject && toggleCell(dayIdx, slotIdx)}
                      data-label={subject || "Free"}
                    >
                      {subject}
                    </td>
                  );
                }
              })}
            </tr>
          ) : (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: 20 }}>
                No classes for selected date!
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary */}
      <h2 style={{ textAlign: "center", color: "#333", marginBottom: 10 }}>
        Attendance Summary
      </h2>
      <table
        className="summary-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "white",
          userSelect: "none",
        }}
      >
        <thead style={{ backgroundColor: "#1976d2", color: "white" }}>
          <tr>
            <th data-label="Subject">Subject</th>
            <th data-label="Lecture Attendance">Lecture Attendance</th>
            <th data-label="Lecture Can Miss">Lecture Can Miss</th>
            <th data-label="Lab Attendance">Lab Attendance</th>
            <th data-label="Lab Can Miss">Lab Can Miss</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary).map(([subject, data]) => {
            const lecConducted = data.lecture.present + data.lecture.absent;
            const lecCanMiss = calcCanMissDynamic(
              data.lecture.present,
              lecConducted,
              data.lecture.total
            );

            const labConducted = data.lab.present + data.lab.absent;
            const labCanMiss = calcCanMissDynamic(
              data.lab.present,
              labConducted,
              data.lab.total
            );

            return (
              <tr key={subject} style={{ textAlign: "center" }}>
                <td
                  data-label="Subject"
                  style={{
                    borderBottom: "1px solid #ddd",
                    padding: 10,
                    fontWeight: "bold",
                  }}
                >
                  {subject}
                </td>
                <td data-label="Lecture Attendance">
                  {data.lecture.present} / {data.lecture.total}
                </td>
                <td data-label="Lecture Can Miss">{lecCanMiss}</td>
                <td data-label="Lab Attendance">
                  {data.lab.present} / {data.lab.total}
                </td>
                <td data-label="Lab Can Miss">{labCanMiss}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
