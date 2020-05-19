#include "dyno.h"
#include "ticlib.h"

void print_vector(vector<int> v)
{
    for (int i {0}; i < v.size(); ++i)
    {
        cout << v[i] << " ";
    }
    cout << "\n";
}

vector<int> create_random_vector(const int size) {
    vector<int> result;
    for (int i{0}; i < 3; ++i)
    {
        result.push_back(random_int(0, 9));
    }
    return result;
}

int main()
{
    cout << "Generador de claves\n";
    cout << "-------------------\n";

    vector<int> clave1;
    vector<int> clave2;
    vector<int> clave3;

    clave1 = create_random_vector(3);
    print_vector(clave1);

    clave2 = create_random_vector(5);
    print_vector(clave2);

    clave3 = create_random_vector(8);
    print_vector(clave3);
}