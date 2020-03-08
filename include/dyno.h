#include <iostream>
#include <fstream>
#include <cstring>

namespace dyno
{
	constexpr int max_allocations = 1024;
	constexpr int line_size = 50;

	class Memory
	{
	public:
		void allocate(void *address, size_t size);
		void free(void *address);
		const char* as_str();

	private:
		void *addresses_[max_allocations];
		size_t sizes_[max_allocations];
		int allocations_ = 0;
		char buffer[line_size*max_allocations];
	};

	void Memory::allocate(void *address, size_t size)
	{
		bool duplicate{ false };
		for (int i{ 0 }; i < allocations_; ++i)
		{
			if (addresses_[i] == address)
			{
				duplicate = true;
				break;
			}
		}
		if (!duplicate)
		{
			if (allocations_ < max_allocations)
			{
				addresses_[allocations_] = address;
				sizes_[allocations_] = size;
				allocations_++;
			}
			else
			{
				std::cerr << "Reached allocations limit\n";
			}
		}
	}

	void Memory::free(void *address)
	{
		bool found{ false };
		for (int i{ 0 }; i < allocations_; ++i)
		{
			if (addresses_[i] == address)
			{
				addresses_[i] = addresses_[allocations_];
				sizes_[i] = sizes_[allocations_];
				allocations_--;
			}
		}
	}

	void push(char* destination, size_t &offset, const char *source) {
		strcpy(destination + offset, source);
		offset += strlen(source);
	}

	const char* Memory::as_str()
	{
		size_t offset{ 0 };
		push(buffer, offset, "[");
		for (int i{ 0 }; i < allocations_; ++i)
		{
			if (i != 0) {
				push(buffer, offset, ",");
			}
			push(buffer, offset, "\n{\"address\":");
			char address_buffer[65535];
			sprintf(address_buffer, "\"%p\"", addresses_[i]);
			push(buffer, offset, address_buffer);
			push(buffer, offset, ", \"size\":");
			char size_buffer[65535];
			sprintf(size_buffer, "%zu", sizes_[i]);
			push(buffer, offset, size_buffer);
			push(buffer, offset, "}");
		}
		push(buffer, offset, "\n]\n");
		return buffer;
	}

	Memory memory;
	const char mem_file_name[8] = "mem.txt";
} // namespace dyno

void *operator new(size_t size)
{
	std::cout << "New called!\n";
	FILE *mem_file = fopen(dyno::mem_file_name, "w");
	// std::ofstream mem_file{ dyno::mem_file_name };
	void *address = malloc(size);
	dyno::memory.allocate(address, size);
	// mem_file << dyno::memory.as_str();
	fputs(dyno::memory.as_str(), mem_file);
	// mem_file.close();
	fclose(mem_file);
	return address;
}

void operator delete(void *address)
{
	std::cout << "Delete called!\n";
	FILE *mem_file = fopen(dyno::mem_file_name, "w");
	// std::ofstream mem_file(dyno::mem_file_name);
	free(address);
	dyno::memory.free(address);
	fputs(dyno::memory.as_str(), mem_file);
	// mem_file << dyno::memory.as_str();
	fclose(mem_file);
	// mem_file.close();
}
