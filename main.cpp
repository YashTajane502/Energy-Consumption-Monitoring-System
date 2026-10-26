// main.cpp
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <limits>
#include <iomanip>
using namespace std;

class Record {
private:
    int id;
    string device;
    string date;
    double units;

public:
    Record() {
        id = 0;
        device = "";
        date = "";
        units = 0;
    }

    Record(int i, string d, string dt, double u) {
        id = i;
        device = d;
        date = dt;
        units = u;
    }

    int getId() const { return id; }
    string getDevice() const { return device; }
    string getDate() const { return date; }
    double getUnits() const { return units; }

    void setDevice(string d) { device = d; }
    void setDate(string dt) { date = dt; }
    void setUnits(double u) { units = u; }

    void display() const {
        cout << left << setw(6) << id
             << setw(20) << device
             << setw(14) << date
             << fixed << setprecision(2) << units << endl;
    }
};

class EnergyMonitor {
private:
    vector<Record> records;
    string fileName;

    int findIndexById(int id) const {
        for (size_t i = 0; i < records.size(); i++) {
            if (records[i].getId() == id)
                return i;
        }
        return -1;
    }

    int getNextId() const {
        int maxId = 0;
        for (size_t i = 0; i < records.size(); i++) {
            if (records[i].getId() > maxId)
                maxId = records[i].getId();
        }
        return maxId + 1;
    }

    void printHeader() const {
        cout << left << setw(6) << "ID"
             << setw(20) << "Device"
             << setw(14) << "Date"
             << "Units (kWh)" << endl;
        cout << "------------------------------------------------------" << endl;
    }

    bool isValidDate(const string &d) const {
        // format DD-MM-YYYY
        if (d.length() != 10) return false;
        if (d[2] != '-' || d[5] != '-') return false;
        for (int i = 0; i < 10; i++) {
            if (i == 2 || i == 5) continue;
            if (d[i] < '0' || d[i] > '9') return false;
        }
        int day = stoi(d.substr(0, 2));
        int month = stoi(d.substr(3, 2));
        int year = stoi(d.substr(6, 4));
        if (day < 1 || day > 31) return false;
        if (month < 1 || month > 12) return false;
        if (year < 2000 || year > 2100) return false;
        return true;
    }

    string readText(const string &prompt) const {
        string s;
        while (true) {
            cout << prompt;
            getline(cin, s);
            bool onlySpaces = true;
            for (size_t i = 0; i < s.length(); i++) {
                if (s[i] != ' ' && s[i] != '\t') {
                    onlySpaces = false;
                    break;
                }
            }
            if (s.empty() || onlySpaces) {
                cout << "Input cannot be empty.\n";
            } else if (s.find('|') != string::npos) {
                cout << "The character '|' is not allowed.\n";
            } else {
                return s;
            }
        }
    }

    string readDate() const {
        string d;
        while (true) {
            d = readText("Enter date (DD-MM-YYYY): ");
            if (isValidDate(d))
                return d;
            cout << "Invalid date format.\n";
        }
    }

    double readUnits() const {
        double u;
        while (true) {
            cout << "Enter units consumed (kWh): ";
            if (cin >> u && u >= 0) {
                cin.ignore(numeric_limits<streamsize>::max(), '\n');
                return u;
            }
            cout << "Invalid input. Enter a non-negative number.\n";
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
        }
    }

public:
    EnergyMonitor(string fname) {
        fileName = fname;
    }

    void loadFromFile() {
        records.clear();
        ifstream fin(fileName.c_str());
        if (!fin) {
            // file does not exist yet, will be created on first save
            return;
        }

        string line;
        while (getline(fin, line)) {
            if (line.empty()) continue;

            size_t p1 = line.find('|');
            size_t p2 = line.find('|', p1 + 1);
            size_t p3 = line.find('|', p2 + 1);
            if (p1 == string::npos || p2 == string::npos || p3 == string::npos) {
                continue;
            }

            try {
                int id = stoi(line.substr(0, p1));
                string device = line.substr(p1 + 1, p2 - p1 - 1);
                string date = line.substr(p2 + 1, p3 - p2 - 1);
                double units = stod(line.substr(p3 + 1));
                records.push_back(Record(id, device, date, units));
            } catch (...) {
                // skip corrupted line
            }
        }
        fin.close();
    }

    bool saveToFile() const {
        ofstream fout(fileName.c_str());
        if (!fout) {
            cout << "Error: could not open file for writing.\n";
            return false;
        }
        for (size_t i = 0; i < records.size(); i++) {
            fout << records[i].getId() << "|"
                 << records[i].getDevice() << "|"
                 << records[i].getDate() << "|"
                 << records[i].getUnits() << "\n";
        }
        if (!fout) {
            cout << "Error: failed while writing to file.\n";
            return false;
        }
        fout.close();
        return true;
    }

    void addRecord() {
        cout << "\n--- Add Record ---\n";
        string device = readText("Enter device name: ");
        string date = readDate();
        double units = readUnits();

        int id = getNextId();
        records.push_back(Record(id, device, date, units));

        if (saveToFile())
            cout << "Record added with ID " << id << ".\n";
    }

    void viewRecords() const {
        cout << "\n--- All Records ---\n";
        if (records.empty()) {
            cout << "No records found.\n";
            return;
        }
        printHeader();
        for (size_t i = 0; i < records.size(); i++) {
            records[i].display();
        }
    }

    void searchRecord() const {
        cout << "\n--- Search Record ---\n";
        if (records.empty()) {
            cout << "No records found.\n";
            return;
        }

        cout << "1. Search by ID\n";
        cout << "2. Search by device name\n";
        cout << "3. Search by date\n";
        cout << "Enter choice: ";
        int ch;
        if (!(cin >> ch)) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid choice.\n";
            return;
        }
        cin.ignore(numeric_limits<streamsize>::max(), '\n');

        bool found = false;

        if (ch == 1) {
            int id;
            cout << "Enter ID: ";
            if (!(cin >> id)) {
                cin.clear();
                cin.ignore(numeric_limits<streamsize>::max(), '\n');
                cout << "Invalid ID.\n";
                return;
            }
            cin.ignore(numeric_limits<streamsize>::max(), '\n');

            int index = findIndexById(id);
            if (index != -1) {
                printHeader();
                records[index].display();
                found = true;
            }
        } else if (ch == 2) {
            string name = readText("Enter device name: ");
            for (size_t i = 0; i < records.size(); i++) {
                if (records[i].getDevice() == name) {
                    if (!found) printHeader();
                    records[i].display();
                    found = true;
                }
            }
        } else if (ch == 3) {
            string date = readDate();
            for (size_t i = 0; i < records.size(); i++) {
                if (records[i].getDate() == date) {
                    if (!found) printHeader();
                    records[i].display();
                    found = true;
                }
            }
        } else {
            cout << "Invalid choice.\n";
            return;
        }

        if (!found)
            cout << "No matching record found.\n";
    }

    void updateRecord() {
        cout << "\n--- Update Record ---\n";
        if (records.empty()) {
            cout << "No records to update.\n";
            return;
        }

        int id;
        cout << "Enter ID of record to update: ";
        if (!(cin >> id)) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid ID.\n";
            return;
        }
        cin.ignore(numeric_limits<streamsize>::max(), '\n');

        int index = findIndexById(id);
        if (index == -1) {
            cout << "Record not found.\n";
            return;
        }

        cout << "Current record:\n";
        printHeader();
        records[index].display();

        cout << "\nEnter new details.\n";
        string device = readText("Enter device name: ");
        string date = readDate();
        double units = readUnits();

        records[index].setDevice(device);
        records[index].setDate(date);
        records[index].setUnits(units);

        if (saveToFile())
            cout << "Record updated.\n";
    }

    void deleteRecord() {
        cout << "\n--- Delete Record ---\n";
        if (records.empty()) {
            cout << "No records to delete.\n";
            return;
        }

        int id;
        cout << "Enter ID of record to delete: ";
        if (!(cin >> id)) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid ID.\n";
            return;
        }
        cin.ignore(numeric_limits<streamsize>::max(), '\n');

        int index = findIndexById(id);
        if (index == -1) {
            cout << "Record not found.\n";
            return;
        }

        char confirm;
        cout << "Are you sure you want to delete this record? (y/n): ";
        cin >> confirm;
        cin.ignore(numeric_limits<streamsize>::max(), '\n');

        if (confirm == 'y' || confirm == 'Y') {
            records.erase(records.begin() + index);
            if (saveToFile())
                cout << "Record deleted.\n";
        } else {
            cout << "Delete cancelled.\n";
        }
    }

    double calculateBill(double totalUnits) const {
        double bill = 0;
        double remaining = totalUnits;

        // slab rates (per unit)
        if (remaining > 0) {
            double slab = (remaining > 100) ? 100 : remaining;
            bill += slab * 3.0;
            remaining -= slab;
        }
        if (remaining > 0) {
            double slab = (remaining > 200) ? 200 : remaining;
            bill += slab * 5.0;
            remaining -= slab;
        }
        if (remaining > 0) {
            bill += remaining * 8.0;
        }
        return bill;
    }

    void analyzeData() const {
        cout << "\n--- Data Analysis ---\n";
        if (records.empty()) {
            cout << "No records available for analysis.\n";
            return;
        }

        double total = 0;
        int highIndex = 0;
        int lowIndex = 0;

        for (size_t i = 0; i < records.size(); i++) {
            total += records[i].getUnits();
            if (records[i].getUnits() > records[highIndex].getUnits())
                highIndex = i;
            if (records[i].getUnits() < records[lowIndex].getUnits())
                lowIndex = i;
        }

        double average = total / records.size();
        double bill = calculateBill(total);

        cout << fixed << setprecision(2);
        cout << "Total records       : " << records.size() << endl;
        cout << "Total consumption   : " << total << " kWh" << endl;
        cout << "Average consumption : " << average << " kWh" << endl;
        cout << "Highest consumption : " << records[highIndex].getUnits()
             << " kWh (" << records[highIndex].getDevice()
             << ", " << records[highIndex].getDate() << ")" << endl;
        cout << "Lowest consumption  : " << records[lowIndex].getUnits()
             << " kWh (" << records[lowIndex].getDevice()
             << ", " << records[lowIndex].getDate() << ")" << endl;

        cout << "\nBill rates: first 100 units Rs.3, next 200 units Rs.5, above 300 units Rs.8\n";
        cout << "Estimated electricity bill: Rs. " << bill << endl;
    }
};

int main() {
    EnergyMonitor monitor("energy_data.txt");
    monitor.loadFromFile();

    int choice;
    do {
        cout << "\n===== Energy Consumption Monitoring System =====\n";
        cout << "1. Add Record\n";
        cout << "2. View All Records\n";
        cout << "3. Search Record\n";
        cout << "4. Update Record\n";
        cout << "5. Delete Record\n";
        cout << "6. Analyze Data and Estimate Bill\n";
        cout << "7. Exit\n";
        cout << "Enter your choice: ";

        if (!(cin >> choice)) {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid input. Please enter a number.\n";
            choice = 0;
            continue;
        }
        cin.ignore(numeric_limits<streamsize>::max(), '\n');

        switch (choice) {
            case 1:
                monitor.addRecord();
                break;
            case 2:
                monitor.viewRecords();
                break;
            case 3:
                monitor.searchRecord();
                break;
            case 4:
                monitor.updateRecord();
                break;
            case 5:
                monitor.deleteRecord();
                break;
            case 6:
                monitor.analyzeData();
                break;
            case 7:
                cout << "Exiting program.\n";
                break;
            default:
                cout << "Invalid choice. Please select 1 to 7.\n";
        }
    } while (choice != 7);

    return 0;
}