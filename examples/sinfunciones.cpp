#include "dyno.h"
#include "ticlib.h"

int main()
{
    cout << "Generador de claves\n";
    cout << "-------------------\n";

    vector<int> clave1;
    vector<int> clave2;
    vector<int> clave3;

    for (int i{0}; i < 3; ++i) {
        clave1.push_back(random_int(0, 9));
    }

    for (int i {0}; i < clave1.size(); ++i) {
        cout << clave1[i] << " ";
    }
    cout << "\n";

    for (int i{0}; i < 3; ++i) {
        clave2.push_back(random_int(0, 9));
    }

    for (int i {0}; i < clave2.size(); ++i) {
        cout << clave2[i] << " ";
    }
    cout << "\n";

    for (int i{0}; i < 3; ++i) {
        clave3.push_back(random_int(0, 9));
    }

    for (int i {0}; i < clave3.size(); ++i) {
        cout << clave3[i] << " ";
    }
    cout << "\n";
}