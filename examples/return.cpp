#include "dyno.h"
#include "ticlib.h"

void mayus(string s)
{
    if (s.size() > 0 && s[0] >= 'a' && s[0] <= 'z') {
        s[0] = s[0] - 32;
    }
}
 
int main()
{
    string nombre {"pepe"};
    cout << "Mal no: " << nombre << "\n";
    mayus(nombre);
    cout << "Mejor: " << nombre << "\n";
}