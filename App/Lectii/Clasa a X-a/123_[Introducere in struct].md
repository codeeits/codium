# Lecția 123: Introducere în Structuri C++

## 📚 Obiectivele lecției
La sfârșitul acestei lecții vei fi capabil să:
- Înțelegi ce sunt structurile în C++
- Declari și definești structuri
- Creezi și utilizezi obiecte de tip structură
- Accesezi membrii unei structuri
- Compari structurile cu clasele

---

## 🏗️ Ce sunt structurile?

**Structura** este un tip de date definit de utilizator care permite gruparea mai multor variabile de tipuri diferite într-o singură entitate. Structurile sunt foarte utile pentru organizarea datelor conexe.

### Sintaxa de bază:
```cpp
struct NumeStructura {
    tip_membru1 nume_membru1;
    tip_membru2 nume_membru2;
    // ... alți membri
};
```

---

## 📝 Declararea unei structuri simple

### Exemplu: Structura Student
```cpp
#include <iostream>
#include <string>

struct Student {
    std::string nume;
    int varsta;
    float media;
    bool activ;
};
```

### Crearea obiectelor:
```cpp
int main() {
    // Declarare și inițializare
    Student student1;
    Student student2 = {"Ion Popescu", 20, 9.5, true};
    
    return 0;
}
```

---

## 🔧 Accesarea membrilor structurii

### Operatorul punct (.)
```cpp
#include <iostream>
#include <string>

struct Student {
    std::string nume;
    int varsta;
    float media;
};

int main() {
    Student student1;
    
    // Atribuire valori
    student1.nume = "Maria Ionescu";
    student1.varsta = 19;
    student1.media = 9.8;
    
    // Afișare valori
    std::cout << "Nume: " << student1.nume << std::endl;
    std::cout << "Vârsta: " << student1.varsta << std::endl;
    std::cout << "Media: " << student1.media << std::endl;
    
    return 0;
}
```

---

## 🚀 Inițializarea structurilor

### 1. Inițializare cu liste
```cpp
struct Punct {
    int x;
    int y;
};

// Diferite moduri de inițializare
Punct p1 = {10, 20};           // Inițializare clasică
Punct p2{15, 25};              // Inițializare uniformă (C++11)
Punct p3 = {.x = 5, .y = 8};   // Inițializare cu nume (C++20)
```

### 2. Inițializare în constructor
```cpp
struct Dreptunghi {
    int lungime;
    int latime;
    
    // Constructor
    Dreptunghi(int l, int lat) {
        lungime = l;
        latime = lat;
    }
};

Dreptunghi drept(10, 5);
```

---

## 🔍 Structuri cu funcții membre

```cpp
struct Calculator {
    float a, b;
    
    // Funcții membre
    float aduna() {
        return a + b;
    }
    
    float scade() {
        return a - b;
    }
    
    float inmulteste() {
        return a * b;
    }
    
    void afiseaza() {
        std::cout << "a = " << a << ", b = " << b << std::endl;
    }
};

int main() {
    Calculator calc = {10.5, 3.2};
    
    calc.afiseaza();
    std::cout << "Suma: " << calc.aduna() << std::endl;
    std::cout << "Diferența: " << calc.scade() << std::endl;
    
    return 0;
}
```

---

## 📊 Exemple practice

### Exemplul 1: Structura pentru coordonate
```cpp
#include <iostream>
#include <cmath>

struct Punct2D {
    double x, y;
    
    // Calculează distanța până la origine
    double distantaLaOrigine() {
        return sqrt(x * x + y * y);
    }
    
    // Calculează distanța până la alt punct
    double distantaLa(Punct2D altPunct) {
        double dx = x - altPunct.x;
        double dy = y - altPunct.y;
        return sqrt(dx * dx + dy * dy);
    }
};

int main() {
    Punkt2D p1 = {3.0, 4.0};
    Punkt2D p2 = {6.0, 8.0};
    
    std::cout << "Distanța p1 la origine: " << p1.distantaLaOrigine() << std::endl;
    std::cout << "Distanța între p1 și p2: " << p1.distantaLa(p2) << std::endl;
    
    return 0;
}
```

### Exemplul 2: Structura pentru produse
```cpp
#include <iostream>
#include <string>

struct Produs {
    std::string nume;
    double pret;
    int cantitate;
    
    // Calculează valoarea totală
    double valoareTotala() {
        return pret * cantitate;
    }
    
    // Verifică dacă e în stoc
    bool eInStoc() {
        return cantitate > 0;
    }
    
    // Afișează informații
    void afiseaza() {
        std::cout << "Produs: " << nume << std::endl;
        std::cout << "Preț: " << pret << " lei" << std::endl;
        std::cout << "Cantitate: " << cantitate << std::endl;
        std::cout << "Valoare totală: " << valoareTotala() << " lei" << std::endl;
        std::cout << "În stoc: " << (eInStoc() ? "Da" : "Nu") << std::endl;
    }
};
```

---

## ⚖️ Structuri vs Clase

| Aspecte | struct | class |
|---------|--------|-------|
| **Accesibilitate implicită** | public | private |
| **Utilizare tipică** | Date simple grupate | Obiecte complexe |
| **Encapsulare** | Mai puțin folosită | Fundamentală |
| **Moștenire** | Suportată | Suportată |

### Exemplu comparativ:
```cpp
// Structură - membri implict publici
struct PunctStruct {
    int x, y;  // public implicit
};

// Clasă - membri implict privați
class PunctClass {
    int x, y;  // private implicit
public:
    void setX(int valoare) { x = valoare; }
    int getX() { return x; }
};
```

---

## 🔄 Structuri îmbricate

```cpp
struct Adresa {
    std::string strada;
    int numar;
    std::string oras;
};

struct Persoana {
    std::string nume;
    int varsta;
    Adresa adresa;  // Structură îmbricată
    
    void afiseaza() {
        std::cout << "Nume: " << nume << std::endl;
        std::cout << "Vârsta: " << varsta << std::endl;
        std::cout << "Adresa: " << adresa.strada << " " 
                  << adresa.numar << ", " << adresa.oras << std::endl;
    }
};

int main() {
    Persoana p = {
        "Ana Popescu", 
        25, 
        {"Str. Florilor", 15, "București"}
    };
    
    p.afiseaza();
    return 0;
}
```

---

## 📝 Exerciții practice

### Exercițiul 1: Structura Carte
Creează o structură `Carte` cu următorii membri:
- `titlu` (string)
- `autor` (string)
- `anPublicare` (int)
- `numarPagini` (int)

Adaugă o funcție membru care verifică dacă cartea este "clasică" (publicată înainte de 1950).

### Exercițiul 2: Structura Cerc
Creează o structură `Cerc` cu:
- `centru` (Punct2D)
- `raza` (double)

Adaugă funcții pentru calcularea ariei și perimetrului.

### Exercițiul 3: Structura complex
Creează o structură pentru numere complexe cu operații de bază (adunare, scădere, înmulțire).

---

## 🎯 Bune practici

### ✅ Recomandări:
- **Folosește nume descriptive** pentru structuri și membri
- **Grupează date logice** în aceeași structură
- **Adaugă funcții membre** pentru operații frecvente
- **Inițializează toate membrii** la declarare
- **Documentează** structurile complexe

### ❌ Evită:
- Structuri cu prea mulți membri (>10)
- Membri publici fără validare în structuri complexe
- Nume generice precum `data`, `info`

---

## 📖 Termeni cheie

- **Structură**: Tip de date definit de utilizator pentru gruparea datelor
- **Membru**: Variabilă sau funcție definită în interiorul unei structuri
- **Operator punct (.)**: Folosit pentru accesarea membrilor unei structuri
- **Inițializare uniformă**: Sintaxa `{}` pentru inițializarea structurilor
- **Structură îmbricată**: Structură definită în interiorul altei structuri

---

## 🎯 Rezumat

În această lecție ai învățat:
- Structurile grupează date conexe într-o singură entitate
- Se declară cu cuvântul cheie `struct`
- Membrii sunt accesați cu operatorul punct (.)
- Pot conține atât date cât și funcții
- Sunt similare cu clasele, dar cu acces public implicit
- Sunt ideale pentru organizarea datelor simple

## 📚 Pentru lecția următoare

În următoarea lecție vom explora:
- Pointeri către structuri
- Alocarea dinamică pentru structuri
- Vectori de structuri
- Structuri și funcții

---

*Mult succes la învățare! 🚀*
