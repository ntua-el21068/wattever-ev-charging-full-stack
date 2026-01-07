# WATTever - Frontend App

Αυτό είναι το Frontend της εφαρμογής φόρτισης, χτισμένο με React, Vite, Tailwind CSS και HeroUI.

## Πως να ξεκινήσετε (SOS)

Πριν γράψετε κώδικα, πρέπει να κατεβάσετε τις βιβλιοθήκες στον υπολογιστή σας:

1. Ανοίξτε τερματικό σε αυτόν τον φάκελο (front-end).
2. Τρέξτε την εντολή:
   npm install
   (Αυτό θα πάρει λίγη ώρα και θα δημιουργήσει τον φάκελο node_modules. ΜΗΝ τον ανεβάσετε στο git).

3. Για να ξεκινήσει η εφαρμογή:
   npm run dev
   Κλικάρετε το link που θα εμφανιστεί (συνήθως http://localhost:5173).

## Δομη Φακελων (Που δουλευει ο καθενας)

Για να μην μπερδευόμαστε, δουλεύουμε στους εξής φακέλους μέσα στο src/:

* src/pages/: Εδώ βρίσκονται οι οθόνες.
    * MapPage.jsx -> Μέλος Α (Χάρτης & Pins)
    * ReservationPage.jsx -> Μέλος Β (Δέσμευση)
    * ChargingPage.jsx -> Μέλος Γ (Φόρτιση & Timer)
* src/components/: Κοινά κομμάτια (π.χ. Navbar, Κουμπιά που χρησιμοποιούμε παντού).
* src/services/: Εδώ είναι το api.js για να μιλάμε με το Backend.
* src/assets/: Εδώ βάζουμε εικόνες/λογότυπα.

## Χρησιμα Links & Documentation

Χρησιμοποιούμε HeroUI (πρώην NextUI) για τα components. Μην γράφετε CSS με το χέρι αν δεν χρειάζεται!

* Κουμπιά & Inputs: https://www.heroui.com/docs/components/button
* Χρώματα & Στυλ (Tailwind): https://nerdcave.com/tailwind-cheat-sheet
* Εικονίδια: https://heroicons.com/

## Κανονες Git

1. Ποτέ δεν πειράζουμε τον κώδικα του άλλου στο src/pages.
2. Πριν κάνετε Push, κάντε πάντα git pull για να πάρετε τις αλλαγές των άλλων.
3. Αν φτιάξετε νέο component που είναι χρήσιμο (π.χ. ChargerCard), βάλτε το στο src/components.