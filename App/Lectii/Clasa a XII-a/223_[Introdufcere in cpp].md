# Introducere în C++

C++ este un limbaj de programare puternic, folosit pentru dezvoltarea de aplicații complexe și performante.

## Cuprins

- [Ce este C++?](#ce-este-c)
- [Structura unui program C++](#structura-unui-program-c)
- [Comentarii](#comentarii)
- [Tipuri de date](#tipuri-de-date)
- [Operatori](#operatori)
- [Controlul fluxului](#controlul-fluxului)
- [Funcții](#funcții)
- [Clase și obiecte](#clase-și-obiecte)
- [Exemple de cod](#exemple-de-cod)
- [Resurse utile](#resurse-utile)

---

## Ce este C++?

C++ este un limbaj de programare multi-paradigmă, dezvoltat de Bjarne Stroustrup, ce extinde C cu facilități de programare orientată pe obiect.

---

## Structura unui program C++

```cpp
#include <iostream>

int main() {
    std::cout << "Salut, lume!" << std::endl;
    return 0;
}
```

---

## Comentarii

- Comentariu pe o linie: `// Acesta este un comentariu`
- Comentariu pe mai multe linii:
  ```cpp
  /* Acesta este
     un comentariu
     pe mai multe linii */
  ```

---

## Tipuri de date

- `int` - numere întregi
- `float`, `double` - numere reale
- `char` - caractere
- `bool` - valori logice

---

## Operatori

- Aritmetici: `+`, `-`, `*`, `/`, `%`
- Relaționali: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logici: `&&`, `||`, `!`

---

## Controlul fluxului

- `if`, `else`
- `switch`
- `for`, `while`, `do...while`

```cpp
if (x > 0) {
    std::cout << "Pozitiv";
} else {
    std::cout << "Negativ sau zero";
}
```

---

## Funcții

```cpp
int aduna(int a, int b) {
    return a + b;
}
```

---

## Clase și obiecte

```cpp
class Masina {
public:
    std::string model;
    int an;

    void porneste() {
        std::cout << "Masina pornita!" << std::endl;
    }
};
```

---

## Exemple de cod

### Citire și afișare

```cpp
#include <iostream>
int main() {
    int x;
    std::cout << "Introdu un numar: ";
    std::cin >> x;
    std::cout << "Ai introdus: " << x << std::endl;
    return 0;
}
```

---

## Resurse utile

- [Documentație oficială C++](https://en.cppreference.com/)
- [Tutorial C++](https://www.learncpp.com/)
- [Compilator online](https://www.onlinegdb.com/online_c++_compiler)
