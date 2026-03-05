const fs = require("fs");

function parseTime(time) {
    let split = time.trim().split(" ");
    let nums = split[0].split(":");
    let hour = parseInt(nums[0]);
    let min = parseInt(nums[1]);
    let sec = parseInt(nums[2]);
    let ampm = split[1].toLowerCase();

    if (ampm === "am" && hour === 12) hour = 0;
    if (ampm === "pm" && hour !== 12) hour += 12;

    return hour * 3600 + min * 60 + sec;
}

function toTimeStr(secs) {
    let hours = Math.floor(secs / 3600);
    let mins = Math.floor((secs % 3600) / 60);
    let s = secs % 60;
    return hours + ":" + String(mins).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function toSeconds(str) {
    let p = str.trim().split(":");
    return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]);
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = parseTime(startTime);
    let end = parseTime(endTime);

    let duration = end - start;
    if (duration < 0) {
        duration = duration + 86400;
    }
    return toTimeStr(duration);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = parseTime(startTime);
    let end = parseTime(endTime);
    if (end < start) end = end + 86400;

    let morning = 8 * 3600; 
    let night = 22 * 3600;   

    let idle = 0;

    if (start < morning) {
        if (end < morning) {
            idle = idle + (end - start);
        } else {
            idle = idle + (morning - start);
        }
    }

    if (end > night) {
        if (start > night) {
            idle = idle + (end - start);
        } else {
            idle = idle + (end - night);
        }
    }

    return toTimeStr(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let total = toSeconds(shiftDuration);
    let idle = toSeconds(idleTime);
    return toTimeStr(total - idle);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// ============================================================
function metQuota(date, activeTime) {
    let dateParts = date.split("-");
    let year = parseInt(dateParts[0]);
    let month = parseInt(dateParts[1]);
    let day = parseInt(dateParts[2]);

    let required;
    if (year === 2025 && month === 4 && day >= 10 && day <= 30) {
        required = 6 * 3600;
    } else {
        required = 8 * 3600 + 24 * 60;
    }

    let active = toSeconds(activeTime);
    if (active >= required) {
        return true;
    } else {
        return false;
    }
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let allLines = content.split("\n").filter(function (line) {
        return line.trim() !== "";
    });

    let header = allLines[0];
    let data = allLines.slice(1);

    for (let i = 0; i < data.length; i++) {
        let parts = data[i].split(",");
        if (parts[0].trim() === shiftObj.driverID && parts[2].trim() === shiftObj.date) {
            return {}; 
        }
    }

    let dur = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let active = getActiveTime(dur, idle);
    let quota = metQuota(shiftObj.date, active);
    let bonus = false;

    let result = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: dur,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: bonus
    };

    let newLine = result.driverID + "," + result.driverName + "," + result.date + "," +
        result.startTime + "," + result.endTime + "," + result.shiftDuration + "," +
        result.idleTime + "," + result.activeTime + "," + result.metQuota + "," + result.hasBonus;

    data.push(newLine);

    data.sort(function (a, b) {
        let colsA = a.split(",");
        let colsB = b.split(",");
        if (colsA[0] < colsB[0]) return -1;
        if (colsA[0] > colsB[0]) return 1;
        if (colsA[2] < colsB[2]) return -1;
        if (colsA[2] > colsB[2]) return 1;
        return 0;
    });

    let output = header + "\n" + data.join("\n") + "\n";
    fs.writeFileSync(textFile, output, { encoding: "utf8" });

    return result;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "" || i === 0) continue; 

        let cols = lines[i].split(",");
        if (cols[0].trim() === driverID && cols[2].trim() === date) {
            cols[cols.length - 1] = String(newValue);
            lines[i] = cols.join(",");
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"), { encoding: "utf8" });
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(function (l) { return l.trim() !== ""; });
    let data = lines.slice(1); 

    let monthNum = parseInt(month);
    let found = false;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
        let cols = data[i].split(",");
        if (cols[0].trim() === driverID) {
            found = true;
            let d = cols[2].trim().split("-");
            let m = parseInt(d[1]);
            if (m === monthNum) {
                if (cols[9].trim() === "true") {
                    count++;
                }
            }
        }
    }

    if (!found) return -1;
    return count;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(function (l) { return l.trim() !== ""; });
    let data = lines.slice(1);

    let total = 0;

    for (let i = 0; i < data.length; i++) {
        let cols = data[i].split(",");
        if (cols[0].trim() === driverID) {
            let dateParts = cols[2].trim().split("-");
            let m = parseInt(dateParts[1]);
            if (m === month) {
                total = total + toSeconds(cols[7].trim());
            }
        }
    }

    return toTimeStr(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(function (l) { return l.trim() !== ""; });
    let data = lines.slice(1);

    let rateContent = fs.readFileSync(rateFile, { encoding: "utf8" });
    let rateLines = rateContent.split("\n").filter(function (l) { return l.trim() !== ""; });

    let dayOff = "";
    for (let i = 0; i < rateLines.length; i++) {
        let cols = rateLines[i].split(",");
        if (cols[0].trim() === driverID) {
            dayOff = cols[1].trim();
            break;
        }
    }

    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let totalRequired = 0;

    for (let i = 0; i < data.length; i++) {
        let cols = data[i].split(",");
        if (cols[0].trim() !== driverID) continue;

        let dateParts = cols[2].trim().split("-");
        let lineMonth = parseInt(dateParts[1]);

        if (lineMonth !== month) continue;

        let dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        let dayName = days[dateObj.getDay()];

        if (dayName === dayOff) continue;

        let yr = parseInt(dateParts[0]);
        let mn = parseInt(dateParts[1]);
        let dy = parseInt(dateParts[2]);

        if (yr === 2025 && mn === 4 && dy >= 10 && dy <= 30) {
            totalRequired = totalRequired + (6 * 3600); 
        } else {
            totalRequired = totalRequired + (8 * 3600 + 24 * 60);
        }
    }

    totalRequired = totalRequired - (bonusCount * 2 * 3600);
    if (totalRequired < 0) totalRequired = 0;

    return toTimeStr(totalRequired);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let rateContent = fs.readFileSync(rateFile, { encoding: "utf8" });
    let rateLines = rateContent.split("\n").filter(function (l) { return l.trim() !== ""; });

    let basePay = 0;
    let tier = 0;

    for (let i = 0; i < rateLines.length; i++) {
        let cols = rateLines[i].split(",");
        if (cols[0].trim() === driverID) {
            basePay = parseInt(cols[2].trim());
            tier = parseInt(cols[3].trim());
            break;
        }
    }

    // how many hours they can miss without getting deducted based on tier
    let allowed;
    if (tier === 1) allowed = 50;
    else if (tier === 2) allowed = 20;
    else if (tier === 3) allowed = 10;
    else if (tier === 4) allowed = 3;
    else allowed = 0;

    let actualSec = toSeconds(actualHours);
    let requiredSec = toSeconds(requiredHours);

    let missing = requiredSec - actualSec;
    if (missing < 0) missing = 0;

    let missingHours = missing / 3600;

    let deductible = missingHours - allowed;
    if (deductible < 0) deductible = 0;
    deductible = Math.floor(deductible); // only count full hours

    let rate = Math.floor(basePay / 185);
    let deduction = deductible * rate;
    let netPay = basePay - deduction;

    return netPay;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};