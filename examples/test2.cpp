#include <iostream>
using namespace std;

char mayus_letra(char c)
{
    if (c >= 'a' && c <= 'z') {
        return c - 32;
    }
    else {
        return c;
    }
}

string mayus(string s)
{
    int i {0};
    while (i < s.size()) {
        s[i] = mayus_letra(s[i]);
        i++;
    }
    return s;
}

void gritar(string s)
{
    cout << mayus(s) << "\n";
}

int main()
{
    string texto {"Hola!"};
    gritar(texto);
}